import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { isValidAwbNumber } from '@/lib/awb'
import { naira } from '@/lib/money'
import { outstandingCredit } from '@/lib/eligibility'
import type { AppData, Booking } from '@/types/domain'
import { approveDispatch, completeBooking, emptyChecks, failPhysicalVerification, type DispatchInput, type PhysicalChecks } from './dispatch'
import { advanceRefund, submitRefundRequest, triggerRefund, validateRefundRequest, type RefundRequestInput } from './refund'
import type { Actor, WorkflowResult } from './result'

const NOW = '2026-10-13T12:00:00+01:00'
const TODAY = '2026-10-13'
const hop: Actor = { name: 'Grace Etim', role: 'head_port_operations' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }
const hoc: Actor = { name: 'Funmilayo Adebayo', role: 'head_of_cargo' }
const lagoon: Actor = { name: 'Adaeze Okafor', role: 'cargo_facilitator', customerId: 'cus-lagoon' }
const gateway: Actor = { name: 'Ibrahim Musa', role: 'cargo_facilitator', customerId: 'cus-gateway' }

const dispatch = (patch: Partial<DispatchInput> = {}): DispatchInput => ({
  wagonNumber: 'NRC-FW-30001', trainNumber: 'LI-FR-09', departureDate: '2026-10-20', departureTime: '06:30', loadingYard: 'Apapa Yard A', remarks: '', ...patch,
})
const allChecks = (): PhysicalChecks => ({ counts: true, cargoAndWeight: true, condition: true, hazardous: true })

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}
const get = (d: AppData, id: string): Booking => d.bookings.find((b) => b.id === id)!

// seed: bk-0398 = Gateway, paid, Pending Dispatch · bk-0405 = Lagoon, Credit Approved · bk-0401 = Gateway, Awaiting Payment (unpaid)
const dispatchBooking = (d: AppData, id: string, actor: Actor = hop) => approveDispatch(d, id, dispatch(), allChecks(), actor, NOW, TODAY)

describe('dispatch gate', () => {
  it('releases paid and credit-approved bookings', () => {
    const d = createSeedData()
    expect(dispatchBooking(d, 'bk-0398').ok).toBe(true)
    expect(dispatchBooking(d, 'bk-0405').ok).toBe(true)
  })
  it('refuses a Pay Now booking that has not been paid', () => {
    const r = dispatchBooking(createSeedData(), 'bk-0401')
    expect(!r.ok && r.error).toMatch(/not been paid|Payment has not cleared/)
  })
  it('refuses bookings still in approval, and other roles', () => {
    const d = createSeedData()
    expect(dispatchBooking(d, 'bk-0418').ok).toBe(false)
    for (const who of [hoc, dir, sa, gateway]) expect(dispatchBooking(d, 'bk-0398', who).ok).toBe(false)
  })
})

describe('dispatch details and physical checks', () => {
  it('requires wagon, train, date and time', () => {
    const d = createSeedData()
    for (const patch of [{ wagonNumber: ' ' }, { trainNumber: '' }, { departureDate: '' }, { departureTime: '' }, { departureTime: '25:99' }, { departureDate: '2026-10-01' }]) {
      expect(approveDispatch(d, 'bk-0398', dispatch(patch), allChecks(), hop, NOW, TODAY).ok).toBe(false)
    }
  })
  it('requires every physical verification item', () => {
    const d = createSeedData()
    for (const k of ['counts', 'cargoAndWeight', 'condition'] as const) {
      expect(approveDispatch(d, 'bk-0398', dispatch(), { ...allChecks(), [k]: false }, hop, NOW, TODAY).ok).toBe(false)
    }
    expect(approveDispatch(d, 'bk-0398', dispatch(), emptyChecks(), hop, NOW, TODAY).ok).toBe(false)
  })
  it('requires hazardous handling confirmation only for hazardous cargo', () => {
    const d = createSeedData()
    const noHaz = { ...allChecks(), hazardous: false }
    expect(approveDispatch(d, 'bk-0398', dispatch(), noHaz, hop, NOW, TODAY).ok).toBe(true)
    get(d, 'bk-0398').hazardous = true
    expect(approveDispatch(d, 'bk-0398', dispatch(), noHaz, hop, NOW, TODAY).ok).toBe(false)
  })
})

describe('AWB generation', () => {
  it('generates a valid AWB, sets dispatch details and audits the transition', () => {
    const r = ok(dispatchBooking(createSeedData(), 'bk-0398'))
    const b = get(r.data, 'bk-0398')
    expect(b.status).toBe('awb_generated')
    expect(isValidAwbNumber(b.awb!.number)).toBe(true)
    expect(b.awb).toMatchObject({ version: 1, generatedAt: NOW })
    expect(b.awb!.verificationRef).toContain(b.awb!.number)
    expect(b.dispatch).toMatchObject({ trainNumber: 'LI-FR-09', wagonNumber: 'NRC-FW-30001', departureTime: '06:30' })
    expect(r.data.audit.at(-1)).toMatchObject({ fromStatus: 'pending_dispatch', toStatus: 'awb_generated', actorRole: 'head_port_operations' })
  })
  it('is idempotent: repeating the action returns the same AWB, no second number, no extra audit', () => {
    const first = ok(dispatchBooking(createSeedData(), 'bk-0398'))
    const again = ok(approveDispatch(first.data, 'bk-0398', dispatch({ trainNumber: 'DIFFERENT' }), allChecks(), hop, '2026-10-14T09:00:00+01:00', TODAY))
    expect(again.existing).toBe(true)
    expect(again.awbNumber).toBe(first.awbNumber)
    expect(get(again.data, 'bk-0398').awb).toEqual(get(first.data, 'bk-0398').awb)
    expect(get(again.data, 'bk-0398').dispatch!.trainNumber).toBe('LI-FR-09') // not overwritten
    expect(again.data.audit.length).toBe(first.data.audit.length)
    expect(again.data.counters.nextAwbSeq).toBe(first.data.counters.nextAwbSeq) // no number consumed
  })
  it('gives each booking a different, never-reused number', () => {
    const a = ok(dispatchBooking(createSeedData(), 'bk-0398'))
    const b = ok(dispatchBooking(a.data, 'bk-0405'))
    const numbers = b.data.bookings.filter((x) => x.awb).map((x) => x.awb!.number)
    expect(new Set(numbers).size).toBe(numbers.length)
    expect(a.awbNumber).not.toBe(b.awbNumber)
  })
  it('completes a booking only after the AWB exists, by Head of Port', () => {
    const d = createSeedData()
    expect(completeBooking(d, 'bk-0398', hop, NOW).ok).toBe(false)
    const awb = ok(dispatchBooking(d, 'bk-0398')).data
    expect(completeBooking(awb, 'bk-0398', dir, NOW).ok).toBe(false)
    expect(get(ok(completeBooking(awb, 'bk-0398', hop, NOW)).data, 'bk-0398').status).toBe('completed')
  })
})

describe('physical verification failure', () => {
  it('requires a reason and the Head of Port', () => {
    const d = createSeedData()
    expect(failPhysicalVerification(d, 'bk-0398', ' ', hop, NOW).ok).toBe(false)
    expect(failPhysicalVerification(d, 'bk-0398', 'Seal broken', dir, NOW).ok).toBe(false)
  })
  it('a paid booking is rejected, capacity released, and a refund is created for the Director', () => {
    const r = ok(failPhysicalVerification(createSeedData(), 'bk-0398', 'Weighbridge reading above declared weight', hop, NOW))
    expect(get(r.data, 'bk-0398').status).toBe('rejected_physical')
    const refund = r.data.refunds.find((x) => x.id === r.refundId)!
    expect(refund).toMatchObject({ bookingId: 'bk-0398', customerId: 'cus-gateway', status: 'awaiting_director', amount: get(r.data, 'bk-0398').approved!.price.totalPayable })
    expect(r.data.audit.at(-1)).toMatchObject({ toStatus: 'rejected_physical', actorRole: 'head_port_operations' })
    expect(r.data.audit.at(-1)!.remarks).toMatch(/Weighbridge.*Capacity released.*refund flow started/)
  })
  it('an unpaid credit booking is rejected with no refund, and stops counting against the credit threshold', () => {
    const d = createSeedData()
    const before = outstandingCredit(d.bookings, 'cus-lagoon')
    expect(before).toBeGreaterThan(0)
    const r = ok(failPhysicalVerification(d, 'bk-0405', 'Cargo not as declared', hop, NOW))
    expect(r.refundId).toBeUndefined()
    expect(r.data.refunds.length).toBe(d.refunds.length)
    expect(get(r.data, 'bk-0405').payment.status).toBe('cancelled')
    expect(outstandingCredit(r.data.bookings, 'cus-lagoon')).toBeLessThan(before)
  })
  it('cannot be failed for unpaid bookings or after an AWB exists', () => {
    const d = createSeedData()
    expect(failPhysicalVerification(d, 'bk-0401', 'x', hop, NOW).ok).toBe(false)
    const awb = ok(dispatchBooking(d, 'bk-0398')).data
    expect(failPhysicalVerification(awb, 'bk-0398', 'x', hop, NOW).ok).toBe(false)
  })
})

describe('refund flow', () => {
  const request = (patch: Partial<RefundRequestInput> = {}): RefundRequestInput => ({
    bankName: 'Demo Bank', accountName: 'Lagoon Freight & Logistics Ltd', accountNumber: '0123456789', confirmedAmount: createSeedData().refunds[0]!.amount, policyAcknowledged: true, ...patch,
  })
  const linked = () => ok(triggerRefund(createSeedData(), 'rf-0380', dir, NOW)).data // seed refund: Lagoon, awaiting Director

  it('Director triggers; nobody else can', () => {
    const d = createSeedData()
    for (const who of [sa, hop, lagoon, hoc]) expect(triggerRefund(d, 'rf-0380', who, NOW).ok).toBe(false)
    const r = ok(triggerRefund(d, 'rf-0380', dir, NOW))
    expect(r.data.refunds[0]).toMatchObject({ status: 'link_sent', linkSentAt: NOW })
    expect(triggerRefund(r.data, 'rf-0380', dir, NOW).ok).toBe(false) // cannot trigger twice
  })
  it('facilitator request needs bank details, a matching amount and the policy acknowledgement', () => {
    const d = linked()
    for (const patch of [{ bankName: '' }, { accountName: ' ' }, { accountNumber: '123' }, { accountNumber: 'abcdefghij' }, { confirmedAmount: naira(1) }, { policyAcknowledged: false }]) {
      expect(submitRefundRequest(d, 'rf-0380', request(patch), lagoon, NOW).ok).toBe(false)
    }
    expect(validateRefundRequest(request(), d.refunds[0]!)).toBeNull()
  })
  it('stores only a masked account reference', () => {
    const r = ok(submitRefundRequest(linked(), 'rf-0380', request(), lagoon, NOW))
    expect(r.data.refunds[0]!.request).toMatchObject({ accountMask: '••••6789', policyAcknowledged: true })
    expect(JSON.stringify(r.data.refunds[0])).not.toContain('0123456789')
  })
  it('only the owning facilitator can request, only while the link is open and inside the window', () => {
    const d = linked()
    expect(submitRefundRequest(d, 'rf-0380', request(), gateway, NOW).ok).toBe(false)
    expect(submitRefundRequest(d, 'rf-0380', request(), dir, NOW).ok).toBe(false)
    expect(submitRefundRequest(createSeedData(), 'rf-0380', request(), lagoon, NOW).ok).toBe(false) // link not sent yet
    expect(submitRefundRequest(d, 'rf-0380', request(), lagoon, '2026-11-20T12:00:00+01:00').ok).toBe(false) // 38 days later
  })
  it('Super Admin moves Requested → Under Review → Approved → Processed, in order', () => {
    let d = ok(submitRefundRequest(linked(), 'rf-0380', request(), lagoon, NOW)).data
    expect(advanceRefund(d, 'rf-0380', 'process', sa, NOW).ok).toBe(false) // cannot skip
    expect(advanceRefund(d, 'rf-0380', 'approve', sa, NOW).ok).toBe(false)
    d = ok(advanceRefund(d, 'rf-0380', 'review', sa, NOW)).data
    expect(d.refunds[0]!.status).toBe('under_review')
    d = ok(advanceRefund(d, 'rf-0380', 'approve', sa, NOW)).data
    d = ok(advanceRefund(d, 'rf-0380', 'process', sa, NOW)).data
    expect(d.refunds[0]).toMatchObject({ status: 'processed', processedAt: NOW, reference: 'DEMO-RFND-0380' })
    expect(d.audit.filter((e) => e.entityType === 'refund').map((e) => e.toStatus)).toEqual(['link_sent', 'requested', 'under_review', 'approved', 'processed'])
  })
  it('separation of duties: the Director cannot process, Super Admin cannot trigger', () => {
    const d = ok(submitRefundRequest(linked(), 'rf-0380', request(), lagoon, NOW)).data
    for (const step of ['review', 'approve', 'process'] as const) expect(advanceRefund(d, 'rf-0380', step, dir, NOW).ok).toBe(false)
    expect(triggerRefund(createSeedData(), 'rf-0380', sa, NOW).ok).toBe(false)
  })
  it('end to end: failed physical check on a paid booking → refund processed', () => {
    let d = ok(failPhysicalVerification(createSeedData(), 'bk-0398', 'Seal broken', hop, NOW)).data
    const id = d.refunds.find((r) => r.bookingId === 'bk-0398')!.id
    d = ok(triggerRefund(d, id, dir, NOW)).data
    d = ok(submitRefundRequest(d, id, request({ confirmedAmount: d.refunds.find((r) => r.id === id)!.amount }), gateway, NOW)).data
    for (const step of ['review', 'approve', 'process'] as const) d = ok(advanceRefund(d, id, step, sa, NOW)).data
    expect(d.refunds.find((r) => r.id === id)!.status).toBe('processed')
  })
})
