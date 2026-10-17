import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { personas } from '@/data/personas'
import { authenticate, authenticateCustomer, demoAccounts, DEMO_PASSWORD, expectedPassword, resolvePersona } from '@/lib/auth'
import { buildMail } from '@/lib/mail'
import { canAccess, hasFullVisibility } from '@/lib/permissions'
import { changeCustomerEligibility, completeFirstLogin, correctCustomerRecord, setCustomerAccountStatus } from '@/lib/workflow/customerAdmin'
import { directorApprove, districtForward, submitRegistration, type EligibilityInput } from '@/lib/workflow/registration'
import { directorApproveBooking, hocApproveBooking } from '@/lib/workflow/bookingApproval'
import { approveDispatch } from '@/lib/workflow/dispatch'
import { advanceRefund, triggerRefund } from '@/lib/workflow/refund'
import { demoRegistration } from '@/features/registrations/RegistrationForm'
import type { Actor } from '@/lib/workflow/result'

const md: Actor = { name: 'Ngozi Adekunle', role: 'managing_director' }
const ds: Actor = { name: 'Chukwuemeka Obi', role: 'district_supervisor', district: 'Lagos' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }

describe('demo sign-in', () => {
  it('every demo account signs in with its published credentials and nothing else', () => {
    for (const a of demoAccounts) {
      expect(authenticate(a.username, a.password)).toBe(a.personaId)
      expect(authenticate(a.username.toUpperCase(), a.password)).toBe(a.personaId)
      expect(authenticate(a.username, 'wrong')).toBeNull()
    }
    expect(authenticate('nobody', DEMO_PASSWORD)).toBeNull()
    expect(authenticate('', '')).toBeNull()
  })
  it('usernames are unique and every account maps to a real persona', () => {
    expect(new Set(demoAccounts.map((a) => a.username)).size).toBe(demoAccounts.length)
    for (const a of demoAccounts) expect(personas.some((p) => p.id === a.personaId)).toBe(true)
  })
  it('lists only the two seeded customer logins plus the new-company applicant', () => {
    expect(demoAccounts.filter((a) => a.personaId.startsWith('p-fac')).map((a) => a.personaId)).toEqual(['p-fac-priority', 'p-fac-standard', 'p-fac-applicant'])
    expect(demoAccounts.some((a) => a.personaId === 'p-md')).toBe(true)
  })
})

describe('the demo applicant becomes a customer once approved', () => {
  const applicant = personas.find((p) => p.isApplicant)!
  const elig: EligibilityInput = { isPriority: true, discountPct: 10, creditMonths: 2, thresholdNaira: 5_000_000, category: 'Strategic' }
  it('starts with no application, then is an active Priority facilitator of the new company after approval', () => {
    const d0 = createSeedData()
    expect(resolvePersona(applicant, d0, '').isApplicant).toBe(true)
    const doc = (kind: 'cac_certificate' | 'company_profile') => ({ id: `d-${kind}`, kind, fileName: `${kind}.pdf`, sizeKb: 1, uploadedAt: '2026-10-14T09:00:00+01:00' })
    const sub = submitRegistration(d0, { ...demoRegistration(), documents: [doc('cac_certificate'), doc('company_profile')] }, { name: 'Zainab Lawal', role: 'cargo_facilitator' }, '2026-10-14T09:00:00+01:00')
    if (!sub.ok) throw new Error(sub.error)
    const appId = (sub as unknown as { applicationId: string }).applicationId
    expect(resolvePersona(applicant, sub.data, appId).isApplicant).toBe(true)
    const fwd = districtForward(sub.data, appId, ds, '', '2026-10-14T10:00:00+01:00')
    if (!fwd.ok) throw new Error(fwd.error)
    const ok = directorApprove(fwd.data, appId, dir, elig, '', '2026-10-14T11:00:00+01:00')
    if (!ok.ok) throw new Error(ok.error)
    const p = resolvePersona(applicant, ok.data, appId)
    expect(p).toMatchObject({ isApplicant: false })
    expect(p.customerId).toBeTruthy()
    expect(ok.data.customers.find((c) => c.id === p.customerId)!.companyName).toBe('Harbour Link Logistics Ltd')
    expect(p.title).toContain('Priority')
  })
})

describe('Managing Director', () => {
  const d = createSeedData()
  it('sees reports, bookings, registrations and customers — and nothing administrative', () => {
    for (const a of ['dashboard', 'reports', 'bookings', 'registrations', 'customers'] as const) expect(canAccess('managing_director', a)).toBe(true)
    for (const a of ['staff', 'master_data', 'payments', 'refunds', 'dispatch', 'new_booking', 'audit'] as const) expect(canAccess('managing_director', a)).toBe(false)
    expect(hasFullVisibility('managing_director')).toBe(true)
  })
  it('is view-only for approvals, dispatch and refunds', () => {
    expect(hocApproveBooking(d, 'bk-0418', md).ok).toBe(false)
    expect(directorApproveBooking(d, 'bk-0412', md, { discountPct: 0, paymentTerms: 'pay_now', creditMonths: 0, reason: '', remarks: '' }).ok).toBe(false)
    expect(districtForward(d, 'reg-ogun', md).ok).toBe(false)
    expect(approveDispatch(d, 'bk-0398', { wagonNumber: 'W1', trainNumber: 'T1', departureDate: '2026-12-01', departureTime: '06:00', loadingYard: '', remarks: '' }, { counts: true, cargoAndWeight: true, condition: true, hazardous: true }, md).ok).toBe(false)
    expect(triggerRefund(d, 'rf-0380', md).ok).toBe(false)
    expect(advanceRefund(d, 'rf-0380', 'review', md).ok).toBe(false)
  })
  it('can suspend, blacklist and reactivate a customer (with a reason) but not change eligibility or records', () => {
    const suspended = setCustomerAccountStatus(d, 'cus-lagoon', 'suspended', 'Management review', md)
    expect(suspended.ok).toBe(true)
    if (suspended.ok) expect(suspended.data.customers.find((c) => c.id === 'cus-lagoon')!.accountStatus).toBe('suspended')
    expect(setCustomerAccountStatus(d, 'cus-lagoon', 'suspended', '', md).ok).toBe(false)
    expect(changeCustomerEligibility(d, 'cus-lagoon', { isPriority: true, discountPct: 5, creditMonths: 1, thresholdNaira: 1000000, category: 'SME' }, 'x', md).ok).toBe(false)
    expect(correctCustomerRecord(d, 'cus-lagoon', { registeredAddress: 'x', pocName: 'x', pocEmail: 'x@x.com', pocCountryCode: '+234', pocPhone: '1' }, 'x', md).ok).toBe(false)
  })
})

describe('first sign-in: temporary password, then the customer’s own', () => {
  function approved() {
    const d0 = createSeedData()
    const doc = (kind: 'cac_certificate' | 'company_profile') => ({ id: `d-${kind}`, kind, fileName: `${kind}.pdf`, sizeKb: 1, uploadedAt: '2026-10-14T09:00:00+01:00' })
    const sub = submitRegistration(d0, { ...demoRegistration(), documents: [doc('cac_certificate'), doc('company_profile')] }, { name: 'Zainab Lawal', role: 'cargo_facilitator' }, '2099-01-01T09:00:00+01:00')
    if (!sub.ok) throw new Error(sub.error)
    const appId = (sub as unknown as { applicationId: string }).applicationId
    const fwd = districtForward(sub.data, appId, ds, '', '2099-01-01T10:00:00+01:00')
    if (!fwd.ok) throw new Error(fwd.error)
    const ok = directorApprove(fwd.data, appId, dir, { isPriority: true, discountPct: 10, creditMonths: 2, thresholdNaira: 5_000_000, category: 'Strategic' }, '', '2099-01-01T11:00:00+01:00')
    if (!ok.ok) throw new Error(ok.error)
    const customer = ok.data.customers.find((c) => c.companyName === 'Harbour Link Logistics Ltd')!
    return { data: ok.data, appId, customer }
  }
  it('a newly approved company must change its temporary password; seeded customers are not forced', () => {
    const { data, customer } = approved()
    expect(customer.firstLogin).toBe(true)
    expect(data.customers.filter((c) => c.firstLogin).map((c) => c.id)).toEqual([customer.id])
  })
  it('signs in with the username and temporary password; the applicant alias stops working once approved', () => {
    const { data, appId, customer } = approved()
    expect(authenticate('obinna', 'demo1234', createSeedData(), '')).toBe('p-fac-applicant') // before approval
    expect(authenticate('obinna', 'demo1234', data, appId)).toBeNull() // after approval
    expect(authenticateCustomer(customer.username, 'demo1234', data, appId, {})).toBe('p-fac-applicant')
    // the contact email is the sign-in name, in any case
    expect(authenticateCustomer(customer.poc.email, 'demo1234', data, appId, {})).toBe('p-fac-applicant')
    expect(authenticateCustomer(customer.poc.email.toUpperCase(), 'demo1234', data, appId, {})).toBe('p-fac-applicant')
    expect(authenticateCustomer(customer.poc.email, 'wrong', data, appId, {})).toBeNull()
    expect(authenticateCustomer(customer.username, 'wrong', data, appId, {})).toBeNull()
  })
  it('after the change only the new password works', () => {
    const { data, appId, customer } = approved()
    const passwords = { [customer.username]: 'Harbour#2026' }
    expect(authenticateCustomer(customer.poc.email, 'Harbour#2026', data, appId, passwords)).toBe('p-fac-applicant')
    expect(authenticateCustomer(customer.username, 'demo1234', data, appId, passwords)).toBeNull()
    expect(expectedPassword(customer.username, passwords)).toBe('Harbour#2026')
    expect(expectedPassword('adaeze', passwords)).toBe(DEMO_PASSWORD)
  })
  it('completeFirstLogin: only the customer’s own account, once, with an audit entry', () => {
    const { data, customer } = approved()
    const me: Actor = { name: 'Obinna Chukwu', role: 'cargo_facilitator', customerId: customer.id }
    expect(completeFirstLogin(data, customer.id, { ...me, customerId: 'cus-lagoon' }).ok).toBe(false)
    expect(completeFirstLogin(data, customer.id, dir).ok).toBe(false)
    const done = completeFirstLogin(data, customer.id, me, '2099-01-02T08:00:00+01:00')
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.data.customers.find((c) => c.id === customer.id)!.firstLogin).toBe(false)
    expect(done.data.audit.at(-1)).toMatchObject({ entityId: customer.id, action: 'Password changed at first sign-in (simulated)' })
    expect(JSON.stringify(done.data.audit.at(-1))).not.toContain('Harbour#')
    expect(completeFirstLogin(done.data, customer.id, me).ok).toBe(false)
    const note = buildMail(done.data).find((m) => m.entityId === customer.id && m.subject.includes('Password changed'))!
    expect(note.to).toEqual([{ kind: 'customer', customerId: customer.id }])
    expect(note.cc).toEqual([]) // a security notice goes to the account holder only
  })
  it('the welcome email says a new password will be required', () => {
    const { data, appId } = approved()
    const w = buildMail(data).find((m) => m.entityId === appId && m.id.endsWith('-welcome'))!
    expect(w.body.join(' ')).toContain('set your own password')
  })
})
