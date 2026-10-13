import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { demoRegistration } from '@/features/registrations/RegistrationForm'
import { validateRegistration, type RegistrationInput } from '@/lib/registration'
import type { AppData } from '@/types/domain'
import {
  addInternalRemark, directorApprove, directorReject, directorSendBack, districtForward, districtSendBack,
  resubmitRegistration, submitRegistration, type EligibilityInput,
} from './registration'
import type { Actor, WorkflowResult } from './result'

const fac: Actor = { name: 'Zainab Lawal', role: 'cargo_facilitator' }
const ds: Actor = { name: 'Chukwuemeka Obi', role: 'district_supervisor' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }

const docs = (data: AppData): RegistrationInput['documents'] =>
  (['cac_certificate', 'company_profile'] as const).map((kind, i) => ({ id: `d${i}`, kind, fileName: `${kind}.pdf`, sizeKb: 100, uploadedAt: '2026-10-13T10:00:00+01:00' }))
    .concat(data.config.taxCertificateRequired ? [{ id: 'd3', kind: 'tax_certificate' as never, fileName: 't.pdf', sizeKb: 1, uploadedAt: '' }] : [])

const valid = (data: AppData): RegistrationInput => ({ ...demoRegistration(), documents: docs(data) })

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}

const priorityInput: EligibilityInput = { isPriority: true, discountPct: 8, creditMonths: 2, thresholdNaira: 4_000_000, category: 'Bulk' }

function submitted() {
  const base = createSeedData()
  const r = ok(submitRegistration(base, valid(base), fac, '2026-10-13T11:00:00+01:00'))
  return { data: r.data, id: r.applicationId }
}

describe('registration validation', () => {
  it('requires mandatory fields and documents', () => {
    const e = validateRegistration({ ...demoRegistration(), companyName: '', cacNumber: 'XX1', modes: [], services: [], documents: [] }, false)
    expect(Object.keys(e).sort()).toEqual(['cacNumber', 'companyName', 'documents', 'modes', 'services'])
  })
  it('validates email and phone', () => {
    const base = demoRegistration()
    expect(validateRegistration({ ...base, poc: { ...base.poc, email: 'nope', phone: '12' } }, false)).toMatchObject({ pocEmail: expect.any(String), pocPhone: expect.any(String) })
  })
})

describe('submission', () => {
  it('creates a pending application with a reference and audit entry', () => {
    const { data, id } = submitted()
    const app = data.applications.find((a) => a.id === id)!
    expect(app.status).toBe('pending_district_verification')
    expect(app.reference).toBe('REG-2026-0108')
    expect(data.audit.at(-1)).toMatchObject({ entityId: id, toStatus: 'pending_district_verification', actorRole: 'cargo_facilitator' })
  })
  it('rejects incomplete submissions and non-facilitators', () => {
    const base = createSeedData()
    expect(submitRegistration(base, { ...valid(base), documents: [] }, fac).ok).toBe(false)
    expect(submitRegistration(base, valid(base), dir).ok).toBe(false)
  })
  it('does not mutate the input data', () => {
    const base = createSeedData()
    const before = base.applications.length
    submitRegistration(base, valid(base), fac)
    expect(base.applications.length).toBe(before)
  })
})

describe('district supervisor', () => {
  it('requires remarks to send back, then facilitator can resubmit', () => {
    const { data, id } = submitted()
    expect(districtSendBack(data, id, ds, '  ').ok).toBe(false)
    const sent = ok(districtSendBack(data, id, ds, 'CAC scan unreadable'))
    expect(sent.data.applications.find((a) => a.id === id)).toMatchObject({ status: 'sent_back_to_facilitator', latestRemark: 'CAC scan unreadable' })

    expect(resubmitRegistration(sent.data, id, valid(data), fac).ok).toBe(false) // not the owner
    const re = ok(resubmitRegistration(sent.data, id, valid(data), { ...fac, applicantAppId: id }))
    expect(re.data.applications.find((a) => a.id === id)!.status).toBe('pending_district_verification')
  })
  it('forwards a clean application to the Director', () => {
    const { data, id } = submitted()
    expect(ok(districtForward(data, id, ds)).data.applications.find((a) => a.id === id)!.status).toBe('pending_director_approval')
  })
  it('blocks forwarding when documents are incomplete', () => {
    const data = createSeedData()
    expect(districtForward(data, 'reg-ekobulk', ds, 'ok anyway').ok).toBe(false)
  })
  it('needs remarks to forward a flagged (blacklist / duplicate CAC) application', () => {
    const data = createSeedData()
    expect(districtForward(data, 'reg-swiftdelta', ds).ok).toBe(false)
    expect(districtForward(data, 'reg-swiftdelta', ds, 'Different entity; verified with CAC portal.').ok).toBe(true)
  })
  it('cannot be done by other roles or at the wrong stage', () => {
    const { data, id } = submitted()
    expect(districtForward(data, id, dir).ok).toBe(false)
    expect(districtSendBack(data, id, sa, 'x').ok).toBe(false)
    expect(directorApprove(data, id, dir, priorityInput).ok).toBe(false) // not yet forwarded
  })
})

describe('director', () => {
  const forwarded = () => {
    const { data, id } = submitted()
    return { data: ok(districtForward(data, id, ds)).data, id }
  }

  it('approves, creating an active customer with the assigned eligibility', () => {
    const { data, id } = forwarded()
    const r = ok(directorApprove(data, id, dir, priorityInput, 'Good standing'))
    const customer = r.data.customers.find((c) => c.id === r.customerId)!
    expect(customer.eligibility).toEqual({ isPriority: true, eligibleDiscountBp: 800, eligibleCreditMonths: 2, creditThreshold: 400_000_000, category: 'Bulk' })
    expect(customer.accountStatus).toBe('active')
    expect(r.data.applications.find((a) => a.id === id)).toMatchObject({ status: 'activated', customerId: customer.id })
    expect(r.data.audit.some((e) => e.entityType === 'customer' && e.change?.field === 'Eligibility')).toBe(true)
  })
  it('forces zero discount and credit for Non-Priority', () => {
    const { data, id } = forwarded()
    const r = ok(directorApprove(data, id, dir, { isPriority: false, discountPct: 15, creditMonths: 6, thresholdNaira: 9_999, category: 'SME' }))
    expect(r.data.customers.find((c) => c.id === r.customerId)!.eligibility).toEqual({ isPriority: false, eligibleDiscountBp: 0, eligibleCreditMonths: 0, creditThreshold: 0, category: 'SME' })
  })
  it('validates eligibility inputs', () => {
    const { data, id } = forwarded()
    expect(directorApprove(data, id, dir, { ...priorityInput, category: '' }).ok).toBe(false)
    expect(directorApprove(data, id, dir, { ...priorityInput, discountPct: 120 }).ok).toBe(false)
    expect(directorApprove(data, id, dir, { ...priorityInput, creditMonths: 2, thresholdNaira: 0 }).ok).toBe(false)
    expect(directorApprove(data, id, dir, { ...priorityInput, creditMonths: 1.5 }).ok).toBe(false)
  })
  it('Super Admin cannot approve (no business authority)', () => {
    const { data, id } = forwarded()
    expect(directorApprove(data, id, sa, priorityInput).ok).toBe(false)
    expect(directorReject(data, id, sa, 'no').ok).toBe(false)
  })
  it('requires remarks to reject or send back, and routes send-back to the District Supervisor', () => {
    const { data, id } = forwarded()
    expect(directorReject(data, id, dir, '').ok).toBe(false)
    expect(directorSendBack(data, id, dir, '').ok).toBe(false)
    expect(ok(directorReject(data, id, dir, 'Duplicate entity')).data.applications.find((a) => a.id === id)!.status).toBe('rejected')
    const back = ok(directorSendBack(data, id, dir, 'Address mismatch'))
    expect(back.data.applications.find((a) => a.id === id)!.status).toBe('sent_back_to_district')
    expect(ok(districtForward(back.data, id, ds)).data.applications.find((a) => a.id === id)!.status).toBe('pending_director_approval')
  })
  it('does not alter existing customers or approved bookings', () => {
    const { data, id } = forwarded()
    const beforeCustomers = JSON.stringify(data.customers)
    const beforeBookings = JSON.stringify(data.bookings)
    const after = ok(directorApprove(data, id, dir, priorityInput)).data
    expect(JSON.stringify(after.customers.slice(0, data.customers.length))).toBe(beforeCustomers)
    expect(JSON.stringify(after.bookings)).toBe(beforeBookings)
  })
  it('generates unique usernames', () => {
    const { data, id } = forwarded()
    const a = ok(directorApprove(data, id, dir, priorityInput))
    const second = ok(submitRegistration(a.data, { ...valid(a.data), cacNumber: 'RC 7700123' }, fac))
    const fwd = ok(districtForward(second.data, second.applicationId, ds))
    const b = ok(directorApprove(fwd.data, second.applicationId, dir, priorityInput))
    expect(b.username).not.toBe(a.username)
  })
})

describe('internal remarks', () => {
  it('are recorded as internal audit entries for NRC reviewers only', () => {
    const { data, id } = submitted()
    expect(addInternalRemark(data, id, fac, 'hi').ok).toBe(false)
    expect(addInternalRemark(data, id, ds, '  ').ok).toBe(false)
    expect(ok(addInternalRemark(data, id, ds, 'Called the POC')).data.audit.at(-1)).toMatchObject({ internal: true, remarks: 'Called the POC' })
  })
})

describe('audit trail', () => {
  it('records from/to status for every transition on the happy path', () => {
    const { data, id } = submitted()
    const d1 = ok(districtForward(data, id, ds)).data
    const d2 = ok(directorApprove(d1, id, dir, priorityInput)).data
    const trail = d2.audit.filter((e) => e.entityId === id).map((e) => `${e.fromStatus ?? '∅'}→${e.toStatus}`)
    expect(trail).toEqual(['∅→pending_district_verification', 'pending_district_verification→pending_director_approval', 'pending_director_approval→activated'])
  })
})
