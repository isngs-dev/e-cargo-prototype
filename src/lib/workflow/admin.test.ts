import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { toCsv } from '@/lib/csv'
import { naira } from '@/lib/money'
import { calculatePrice, findRate } from '@/lib/pricing'
import { indicativePrice, emptyBooking, createBooking } from './booking'
import { changeCustomerEligibility, correctCustomerRecord, setCustomerAccountStatus } from './customerAdmin'
import { addRoute, insertFreightRate, setRouteActive, updateConfig, validateConfig, type RateInput } from './masterData'
import { matchableBookings, resolvePaymentException } from './paymentException'
import { advanceRefund, submitRefundRequest, triggerRefund } from './refund'
import type { Actor, WorkflowResult } from './result'
import { createStaff, reassignStaffRole, resetStaffPassword, setStaffAccess, updateStaffDetails, type StaffInput } from './staff'
import { isReadyForDispatch } from '@/lib/status'

const NOW = '2026-10-14T10:00:00+01:00'
const TODAY = '2026-10-14'
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const hoc: Actor = { name: 'Funmilayo Adebayo', role: 'head_of_cargo' }
const lagoonFac: Actor = { name: 'Adaeze Okafor', role: 'cargo_facilitator', customerId: 'cus-lagoon' }

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('staff accounts (Super Admin only)', () => {
  const input = (patch: Partial<StaffInput> = {}): StaffInput => ({ name: 'Ngozi Eze', email: 'n.eze@nrc.demo', role: 'head_of_cargo', ...patch })

  it('creates a pending-first-login account and audits it, without exposing credentials', () => {
    const r = ok(createStaff(createSeedData(), input(), sa, NOW))
    const s = r.data.staff.find((x) => x.id === r.staffId)!
    expect(s).toMatchObject({ role: 'head_of_cargo', status: 'pending_first_login' })
    expect(r.data.audit.at(-1)).toMatchObject({ entityType: 'staff', toStatus: 'pending_first_login', actorRole: 'super_admin' })
    expect(JSON.stringify(r.data.staff)).not.toMatch(/password/i)
  })
  it('only Super Admin; Director and others cannot', () => {
    const d = createSeedData()
    for (const who of [dir, hoc, lagoonFac]) {
      expect(createStaff(d, input(), who, NOW).ok).toBe(false)
      expect(setStaffAccess(d, 'st-hoc', 'suspend', 'x', who, NOW).ok).toBe(false)
      expect(resetStaffPassword(d, 'st-hoc', who, NOW).ok).toBe(false)
    }
  })
  it('validates name, email, duplicates, role and the district of a District Supervisor', () => {
    const d = createSeedData()
    expect(createStaff(d, input({ name: '' }), sa, NOW).ok).toBe(false)
    expect(createStaff(d, input({ email: 'nope' }), sa, NOW).ok).toBe(false)
    expect(createStaff(d, input({ email: 'F.Adebayo@nrc.demo' }), sa, NOW).ok).toBe(false) // duplicate, case-insensitive
    expect(createStaff(d, input({ role: 'super_admin' as never }), sa, NOW).ok).toBe(false)
    expect(createStaff(d, input({ role: 'district_supervisor' }), sa, NOW).ok).toBe(false)
    expect(createStaff(d, input({ role: 'district_supervisor', district: 'Ibadan' }), sa, NOW).ok).toBe(true)
  })
  it('suspend → reactivate; revoke is permanent; reasons are mandatory', () => {
    const d = createSeedData()
    expect(setStaffAccess(d, 'st-hoc', 'suspend', ' ', sa, NOW).ok).toBe(false)
    const sus = ok(setStaffAccess(d, 'st-hoc', 'suspend', 'On leave', sa, NOW)).data
    expect(sus.staff.find((s) => s.id === 'st-hoc')!.status).toBe('suspended')
    expect(setStaffAccess(sus, 'st-hoc', 'suspend', 'again', sa, NOW).ok).toBe(false)
    expect(resetStaffPassword(sus, 'st-hoc', sa, NOW).ok).toBe(false) // reactivate first
    const back = ok(setStaffAccess(sus, 'st-hoc', 'reactivate', 'Returned', sa, NOW)).data
    expect(back.staff.find((s) => s.id === 'st-hoc')!.status).toBe('active')
    const rev = ok(setStaffAccess(back, 'st-hoc', 'revoke', 'Left NRC', sa, NOW)).data
    expect(rev.staff.find((s) => s.id === 'st-hoc')!.status).toBe('revoked')
    expect(setStaffAccess(rev, 'st-hoc', 'reactivate', 'x', sa, NOW).ok).toBe(false)
    expect(updateStaffDetails(rev, 'st-hoc', { name: 'X Y', email: 'x@y.com' }, sa, NOW).ok).toBe(false)
  })
  it('password reset forces a first-login change', () => {
    const r = ok(resetStaffPassword(createSeedData(), 'st-hoc', sa, NOW))
    expect(r.data.staff.find((s) => s.id === 'st-hoc')!.status).toBe('pending_first_login')
  })
  it('reassigns role and district with a reason, logging old → new', () => {
    const d = createSeedData()
    expect(reassignStaffRole(d, 'st-hoc', 'district_supervisor', 'Ibadan', ' ', sa, NOW).ok).toBe(false)
    expect(reassignStaffRole(d, 'st-hoc', 'district_supervisor', undefined, 'Transfer', sa, NOW).ok).toBe(false)
    const r = ok(reassignStaffRole(d, 'st-hoc', 'district_supervisor', 'Ibadan', 'Transfer to Ibadan', sa, NOW))
    expect(r.data.staff.find((s) => s.id === 'st-hoc')).toMatchObject({ role: 'district_supervisor', district: 'Ibadan' })
    expect(r.data.audit.at(-1)!.change).toEqual({ field: 'Role', from: 'head of cargo', to: 'district supervisor (Ibadan)' })
    const back = ok(reassignStaffRole(r.data, 'st-hoc', 'head_of_cargo', undefined, 'Back', sa, NOW))
    expect(back.data.staff.find((s) => s.id === 'st-hoc')!.district).toBeUndefined()
  })
  it('the Super Admin account itself cannot be changed here', () => {
    expect(setStaffAccess(createSeedData(), 'st-sa', 'suspend', 'x', sa, NOW).ok).toBe(false)
  })
})

describe('master data', () => {
  const rate = (patch: Partial<RateInput> = {}): RateInput => ({ routeId: 'rt-ebm', cargoType: 'Containerized', containerType: '20ft', rateNaira: 95_000, effectiveFrom: '2026-11-01', ...patch })

  it('inserts a new effective-dated row and never edits or removes existing rows', () => {
    const d = createSeedData()
    const r = ok(insertFreightRate(d, rate(), sa, NOW, TODAY))
    expect(r.data.freightRates.length).toBe(d.freightRates.length + 1)
    for (const old of d.freightRates) expect(r.data.freightRates).toContainEqual(old)
    expect(r.data.audit.at(-1)!.change).toMatchObject({ from: '₦90,000.00', to: '₦95,000.00' })
    // rate in force depends on the booking date
    expect(findRate(r.data.freightRates, 'rt-ebm', 'Containerized', '20ft', '2026-10-31')!.ratePerUnit).toBe(naira(90_000))
    expect(findRate(r.data.freightRates, 'rt-ebm', 'Containerized', '20ft', '2026-11-01')!.ratePerUnit).toBe(naira(95_000))
  })
  it('only Super Admin; the Director has view access only', () => {
    expect(insertFreightRate(createSeedData(), rate(), dir, NOW, TODAY).ok).toBe(false)
    expect(addRoute(createSeedData(), { code: 'APP-XYZ', origin: 'A', destination: 'B', distanceKm: 5 }, dir, NOW).ok).toBe(false)
    expect(updateConfig(createSeedData(), { ...createSeedData().config, refundWindowDays: 14 }, dir, NOW).ok).toBe(false)
  })
  it('validates rates: positive, not back-dated, right unit, no duplicate effective date', () => {
    const d = createSeedData()
    for (const patch of [{ rateNaira: 0 }, { rateNaira: NaN }, { effectiveFrom: '2026-10-01' }, { effectiveFrom: '' }, { containerType: 'Wagon' as const }, { routeId: 'nope' }, { effectiveFrom: '2026-01-01' }]) {
      expect(insertFreightRate(d, rate(patch), sa, NOW, TODAY).ok).toBe(false)
    }
    const once = ok(insertFreightRate(d, rate(), sa, NOW, TODAY)).data
    expect(insertFreightRate(once, rate(), sa, NOW, TODAY).ok).toBe(false)
  })
  it('a newly added rate unblocks the previously unpriceable Moniya non-containerized booking', () => {
    const d = createSeedData()
    const gateway = d.customers.find((c) => c.id === 'cus-gateway')!
    const probe = { routeId: 'rt-mny', cargoType: 'Non-Containerized' as const, containers: [{ containerType: 'Wagon' as const, quantity: 2 }], bookingDate: '2026-12-01' }
    expect(indicativePrice(d, gateway, probe).ok).toBe(false)
    const withRate = ok(insertFreightRate(d, rate({ routeId: 'rt-mny', cargoType: 'Non-Containerized', containerType: 'Wagon', rateNaira: 200_000, effectiveFrom: '2026-11-15' }), sa, NOW, TODAY)).data
    expect(indicativePrice(withRate, gateway, probe).ok).toBe(true)
    expect(indicativePrice(withRate, gateway, { ...probe, bookingDate: '2026-11-01' }).ok).toBe(false) // before the effective date
  })
  it('rate and config changes never alter an approved booking’s frozen price', () => {
    const d = createSeedData()
    const frozen = JSON.stringify(d.bookings.find((b) => b.id === 'bk-0398')!.approved)
    let n = ok(insertFreightRate(d, rate({ routeId: 'rt-apl', cargoType: 'Non-Containerized', containerType: 'Wagon', rateNaira: 999_999 }), sa, NOW, TODAY)).data
    n = ok(updateConfig(n, { ...n.config, tax: { ...n.config.tax, vatBp: 1000, basis: 'gross' } }, sa, NOW)).data
    expect(JSON.stringify(n.bookings.find((b) => b.id === 'bk-0398')!.approved)).toBe(frozen)
  })
  it('adds routes (unique code, no rates yet) and deactivates without deleting', () => {
    const d = createSeedData()
    const added = ok(addRoute(d, { code: 'app-ikj', origin: 'Apapa Port', destination: 'Ikeja', distanceKm: 30 }, sa, NOW)).data
    expect(added.routes.find((r) => r.code === 'APP-IKJ')).toMatchObject({ active: true })
    expect(addRoute(added, { code: 'APP-IKJ', origin: 'A', destination: 'B', distanceKm: 5 }, sa, NOW).ok).toBe(false)
    expect(addRoute(d, { code: 'x', origin: 'A', destination: 'B', distanceKm: 5 }, sa, NOW).ok).toBe(false)
    const off = ok(setRouteActive(added, 'rt-apl', false, sa, NOW)).data
    expect(off.routes.find((r) => r.id === 'rt-apl')!.active).toBe(false)
    expect(off.bookings.some((b) => b.routeId === 'rt-apl')).toBe(true) // existing bookings keep their route
    expect(setRouteActive(off, 'rt-apl', false, sa, NOW).ok).toBe(false)
    // inactive route cannot be booked
    const lagoon = off.customers.find((c) => c.id === 'cus-lagoon')!
    expect(lagoon).toBeDefined()
    const booking = createBooking(off, { ...emptyBooking(), bookingDate: '2026-12-01', routeId: 'rt-apl', containers: [{ containerType: '20ft', quantity: 1 }], weightTons: 10, commodity: 'Rice', declaration: true,
      documents: (['bill_of_lading', 'packing_list', 'invoice'] as const).map((k) => ({ id: k, kind: k, fileName: 'x.pdf', sizeKb: 1, uploadedAt: NOW })) }, lagoonFac, NOW, TODAY)
    expect(booking.ok).toBe(false)
  })
  it('config: one audit entry per changed setting with old → new; validates ranges', () => {
    const d = createSeedData()
    const r = ok(updateConfig(d, { ...d.config, paymentWindowHours: 48, refundWindowDays: 14 }, sa, NOW, 'NRC confirmed'))
    expect(r.changed).toBe(2)
    expect(r.data.config).toMatchObject({ paymentWindowHours: 48, refundWindowDays: 14 })
    const entries = r.data.audit.filter((e) => e.entityType === 'master_data' && e.action.startsWith('Configuration changed'))
    expect(entries.map((e) => e.change!.field).sort()).toEqual(['paymentWindowHours', 'refundWindowDays'])
    expect(entries[0]!.change).toMatchObject({ from: expect.any(String), to: expect.any(String) })
    expect(updateConfig(d, d.config, sa, NOW).ok).toBe(false) // nothing changed
    for (const bad of [{ ...d.config, paymentWindowHours: 0 }, { ...d.config, paymentReminderHours: 72 }, { ...d.config, refundWindowDays: 400 }, { ...d.config, tax: { ...d.config.tax, vatBp: 9000 } }]) {
      expect(validateConfig(bad)).not.toBeNull()
    }
  })
  it('a different tax basis changes pricing for future bookings only', () => {
    const d = createSeedData()
    const gross = ok(updateConfig(d, { ...d.config, tax: { ...d.config.tax, basis: 'gross' } }, sa, NOW)).data
    const input = { routeId: 'rt-ebm', cargoType: 'Containerized' as const, containers: [{ containerType: '20ft' as const, quantity: 2 }], bookingDate: '2026-10-20', discountBp: 1000 }
    expect(calculatePrice(input, d.freightRates, d.config.tax).totalPayable).toBe(naira(177_795))
    expect(calculatePrice(input, gross.freightRates, gross.config.tax).totalPayable).not.toBe(naira(177_795))
  })
})

describe('customer administration', () => {
  const upgrade = { isPriority: true, discountPct: 8, creditMonths: 1, thresholdNaira: 2_000_000, category: 'SME' as const }

  it('Director and Super Admin suspend / blacklist / reactivate with a reason, audited with old → new status', () => {
    const d = createSeedData()
    expect(setCustomerAccountStatus(d, 'cus-lagoon', 'suspended', ' ', dir, NOW).ok).toBe(false)
    for (const who of [hoc, lagoonFac]) expect(setCustomerAccountStatus(d, 'cus-lagoon', 'suspended', 'x', who, NOW).ok).toBe(false)
    const s = ok(setCustomerAccountStatus(d, 'cus-lagoon', 'suspended', 'Unpaid invoices', sa, NOW)).data
    expect(s.customers.find((c) => c.id === 'cus-lagoon')!.accountStatus).toBe('suspended')
    expect(s.audit.at(-1)).toMatchObject({ fromStatus: 'active', toStatus: 'suspended', remarks: 'Unpaid invoices' })
    expect(setCustomerAccountStatus(s, 'cus-lagoon', 'suspended', 'again', dir, NOW).ok).toBe(false)
    expect(ok(setCustomerAccountStatus(s, 'cus-lagoon', 'blacklisted', 'Fraud', dir, NOW)).data.customers.find((c) => c.id === 'cus-lagoon')!.accountStatus).toBe('blacklisted')
    expect(ok(setCustomerAccountStatus(s, 'cus-lagoon', 'active', 'Resolved', dir, NOW)).data.customers.find((c) => c.id === 'cus-lagoon')!.accountStatus).toBe('active')
  })
  it('a suspended customer can no longer create bookings', () => {
    const d = ok(setCustomerAccountStatus(createSeedData(), 'cus-lagoon', 'suspended', 'x', dir, NOW)).data
    const r = createBooking(d, { ...emptyBooking(), bookingDate: '2026-12-01', routeId: 'rt-ebm', containers: [{ containerType: '20ft', quantity: 1 }], weightTons: 10, commodity: 'Rice', declaration: true,
      documents: (['bill_of_lading', 'packing_list', 'invoice'] as const).map((k) => ({ id: k, kind: k, fileName: 'x.pdf', sizeKb: 1, uploadedAt: NOW })) }, lagoonFac, NOW, TODAY)
    expect(!r.ok && r.error).toMatch(/suspended/)
  })
  it('only the Director changes eligibility — Super Admin cannot (D-14); reason mandatory; logged old → new', () => {
    const d = createSeedData()
    expect(changeCustomerEligibility(d, 'cus-gateway', upgrade, 'Good record', sa, NOW).ok).toBe(false)
    expect(changeCustomerEligibility(d, 'cus-gateway', upgrade, ' ', dir, NOW).ok).toBe(false)
    expect(changeCustomerEligibility(d, 'cus-gateway', { ...upgrade, discountPct: 150 }, 'x', dir, NOW).ok).toBe(false)
    const r = ok(changeCustomerEligibility(d, 'cus-gateway', upgrade, 'Consistent volumes', dir, NOW))
    expect(r.data.customers.find((c) => c.id === 'cus-gateway')!.eligibility).toMatchObject({ isPriority: true, eligibleDiscountBp: 800, eligibleCreditMonths: 1 })
    expect(r.data.audit.at(-1)).toMatchObject({ action: expect.stringContaining('upgraded to Priority'), remarks: 'Consistent volumes' })
    expect(r.data.audit.at(-1)!.change!.from).toContain('Non-Priority')
    expect(changeCustomerEligibility(r.data, 'cus-gateway', upgrade, 'again', dir, NOW).ok).toBe(false) // no change
  })
  it('an upgrade is never retroactive: approved bookings keep their frozen price and snapshot; future indicative prices use the new eligibility', () => {
    const d = createSeedData()
    const frozenBefore = JSON.stringify(d.bookings.find((b) => b.id === 'bk-0398')!.approved)
    const r = ok(changeCustomerEligibility(d, 'cus-gateway', upgrade, 'Upgrade', dir, NOW)).data
    expect(JSON.stringify(r.bookings.find((b) => b.id === 'bk-0398')!.approved)).toBe(frozenBefore)
    expect(r.bookings.find((b) => b.id === 'bk-0398')!.approved!.eligibilitySnapshot.isPriority).toBe(false)
    const next = indicativePrice(r, r.customers.find((c) => c.id === 'cus-gateway')!, { routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }], bookingDate: '2026-12-01' })
    expect(next.ok && next.price.discountBp).toBe(800)
  })
  it('Super Admin corrects address / contact but not commercial terms', () => {
    const d = createSeedData()
    const patch = { registeredAddress: '99 New Wharf Road, Apapa', pocName: 'Adaeze Okafor', pocEmail: 'adaeze@lagoonfreight.demo', pocCountryCode: '+234', pocPhone: '803 412 7781' }
    expect(correctCustomerRecord(d, 'cus-lagoon', patch, 'Moved office', dir, NOW).ok).toBe(false)
    expect(correctCustomerRecord(d, 'cus-lagoon', patch, ' ', sa, NOW).ok).toBe(false)
    expect(correctCustomerRecord(d, 'cus-lagoon', { ...patch, pocEmail: 'bad' }, 'x', sa, NOW).ok).toBe(false)
    const r = ok(correctCustomerRecord(d, 'cus-lagoon', patch, 'Moved office', sa, NOW)).data
    const c = r.customers.find((x) => x.id === 'cus-lagoon')!
    expect(c.registeredAddress).toBe('99 New Wharf Road, Apapa')
    expect(c.eligibility).toEqual(d.customers.find((x) => x.id === 'cus-lagoon')!.eligibility)
  })
})

describe('payment exceptions', () => {
  it('seed has an unmatched, a duplicate and an invoice-matching exception', () => {
    const d = createSeedData()
    expect(d.paymentExceptions.map((p) => p.id)).toEqual(['px-1', 'px-2', 'px-3'])
    expect(matchableBookings(d, d.paymentExceptions[2]!.amount).map((b) => b.id)).toEqual(['bk-0401'])
    expect(matchableBookings(d, d.paymentExceptions[0]!.amount)).toEqual([])
  })
  it('only Super Admin resolves, with a mandatory note', () => {
    const d = createSeedData()
    expect(resolvePaymentException(d, 'px-1', { action: 'returned' }, 'x', dir, NOW).ok).toBe(false)
    expect(resolvePaymentException(d, 'px-1', { action: 'returned' }, ' ', sa, NOW).ok).toBe(false)
    expect(ok(resolvePaymentException(d, 'px-1', { action: 'returned' }, 'Returned to payer', sa, NOW)).data.paymentExceptions[0]).toMatchObject({ resolved: true, resolution: { action: 'returned' } })
    const once = ok(resolvePaymentException(d, 'px-1', { action: 'returned' }, 'ok', sa, NOW)).data
    expect(resolvePaymentException(once, 'px-1', { action: 'returned' }, 'again', sa, NOW).ok).toBe(false)
  })
  it('matching applies the payment to the exact open invoice and releases it towards dispatch', () => {
    const d = createSeedData()
    expect(resolvePaymentException(d, 'px-3', { action: 'matched', bookingId: 'bk-0420' }, 'x', sa, NOW).ok).toBe(false) // wrong invoice
    expect(resolvePaymentException(d, 'px-1', { action: 'matched', bookingId: 'bk-0401' }, 'x', sa, NOW).ok).toBe(false) // wrong amount
    const r = ok(resolvePaymentException(d, 'px-3', { action: 'matched', bookingId: 'bk-0401' }, 'Customer paid outside the link', sa, NOW)).data
    const b = r.bookings.find((x) => x.id === 'bk-0401')!
    expect(b).toMatchObject({ status: 'pending_dispatch', payment: { status: 'paid' } })
    expect(isReadyForDispatch(b)).toBe(true)
    expect(r.audit.some((e) => e.entityId === 'bk-0401' && e.toStatus === 'pending_dispatch')).toBe(true)
  })
  it('a duplicate payment starts the refund flow, which only the Director can trigger and Super Admin process', () => {
    const d = createSeedData()
    expect(resolvePaymentException(d, 'px-1', { action: 'duplicate_refund' }, 'x', sa, NOW).ok).toBe(false) // not linked to a booking
    const r = ok(resolvePaymentException(d, 'px-2', { action: 'duplicate_refund' }, 'Customer paid twice', sa, NOW)).data
    const refund = r.refunds.find((x) => x.id === 'rf-px-2')!
    expect(refund).toMatchObject({ status: 'awaiting_director', customerId: 'cus-lagoon', bookingId: 'bk-0380' })
    expect(resolvePaymentException(r, 'px-2', { action: 'duplicate_refund' }, 'again', sa, NOW).ok).toBe(false)
    let x = ok(triggerRefund(r, 'rf-px-2', dir, NOW)).data
    x = ok(submitRefundRequest(x, 'rf-px-2', { bankName: 'Demo Bank', accountName: 'Lagoon', accountNumber: '0123456789', confirmedAmount: refund.amount, policyAcknowledged: true }, lagoonFac, NOW)).data
    for (const step of ['review', 'approve', 'process'] as const) x = ok(advanceRefund(x, 'rf-px-2', step, sa, NOW)).data
    expect(x.refunds.find((y) => y.id === 'rf-px-2')!.status).toBe('processed')
  })
})

describe('csv export', () => {
  it('quotes commas, quotes and newlines', () => expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['l1\nl2', 3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"l1\nl2",3'))
  it('neutralises spreadsheet formulas', () => expect(toCsv(['a'], [['=SUM(A1)'], ['+1'], ['@cmd'], ['-5']])).toBe("a\r\n'=SUM(A1)\r\n'+1\r\n'@cmd\r\n'-5"))
})
