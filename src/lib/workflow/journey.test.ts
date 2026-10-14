import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { demoRegistration } from '@/features/registrations/RegistrationForm'
import { isReadyForDispatch } from '@/lib/status'
import type { AppData, AuditEntry, Booking } from '@/types/domain'
import { createBooking, emptyBooking, resubmitBooking, type BookingInput } from './booking'
import {
  directorApproveBooking, directorRejectBooking, directorSendBackBooking, hocApproveBooking, hocRejectBooking, hocSendBackBooking,
  type DirectorDecision,
} from './bookingApproval'
import { amendAwb, approveDispatch, completeBooking, failPhysicalVerification } from './dispatch'
import { autoCancelUnpaid, issueCreditPaymentLink, reconcilePayment, settleCredit, simulatePayment } from './payment'
import { advanceRefund, reverseRefund, submitRefundRequest, triggerRefund } from './refund'
import { directorApprove, districtForward, districtSendBack, resubmitRegistration, submitRegistration, type EligibilityInput } from './registration'
import type { Actor, WorkflowResult } from './result'

/**
 * End-to-end journeys at workflow level: registration → booking → approvals → payment → dispatch → AWB,
 * plus every rejection / send-back / failure branch. Each journey ends by checking the audit trail invariants.
 */

const TODAY = '2026-10-14'
let tick = 0
const t = () => `2026-10-14T${String(8 + Math.floor(tick / 60)).padStart(2, '0')}:${String(tick++ % 60).padStart(2, '0')}:00+01:00`

const hoc: Actor = { name: 'Funmilayo Adebayo', role: 'head_of_cargo' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const hop: Actor = { name: 'Grace Etim', role: 'head_port_operations' }
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }
const ds: Actor = { name: 'Chukwuemeka Obi', role: 'district_supervisor', district: 'Lagos' }

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}
const get = (d: AppData, id: string): Booking => d.bookings.find((b) => b.id === id)!

const docs = (['bill_of_lading', 'packing_list', 'invoice'] as const).map((k) => ({ id: k, kind: k, fileName: `${k}.pdf`, sizeKb: 1, uploadedAt: t() }))
const bookingInput = (patch: Partial<BookingInput> = {}): BookingInput => ({
  ...emptyBooking(), bookingDate: '2026-11-12', routeId: 'rt-ebm', containers: [{ containerType: '20ft', quantity: 2 }], weightTons: 38,
  commodity: 'Packaged beverages', documents: docs, declaration: true, ...patch,
})
const decision = (patch: Partial<DirectorDecision> = {}): DirectorDecision => ({ discountPct: 10, paymentTerms: 'pay_now', creditMonths: 0, reason: '', remarks: '', ...patch })
const dispatchInput = { wagonNumber: 'NRC-FW-40001', trainNumber: 'LI-FR-21', departureDate: '2026-10-25', departureTime: '07:15', loadingYard: 'Apapa Yard A', remarks: '' }
const checks = { counts: true, cargoAndWeight: true, condition: true, hazardous: true }
const priority: EligibilityInput = { isPriority: true, discountPct: 10, creditMonths: 2, thresholdNaira: 5_000_000, category: 'Strategic' }

/** Audit invariants for one record: statuses chain without gaps, time never goes backwards, every entry names an actor and role. */
function expectCleanTrail(d: AppData, entityId: string, types: AuditEntry['entityType'][]) {
  const trail = d.audit.filter((e) => e.entityId === entityId && types.includes(e.entityType))
  expect(trail.length).toBeGreaterThan(0)
  let prev: string | undefined
  let prevAt = ''
  for (const e of trail) {
    expect(e.actorName.length).toBeGreaterThan(0)
    expect(e.actorRole).toBeTruthy()
    expect(e.at >= prevAt).toBe(true)
    prevAt = e.at
    if (e.toStatus) {
      expect(e.fromStatus ?? undefined).toBe(prev)
      prev = e.toStatus
    }
  }
  return prev // the last recorded status
}

/** Registers a brand-new Lagoon-district company and activates it as Priority. Returns the new customer's actor. */
function onboard(base: AppData, cac: string): { data: AppData; facilitator: Actor; customerId: string } {
  const input = { ...demoRegistration(), cacNumber: cac, companyName: `Journey Co ${cac}`, documents: [{ id: 'd1', kind: 'cac_certificate' as const, fileName: 'c.pdf', sizeKb: 1, uploadedAt: t() }, { id: 'd2', kind: 'company_profile' as const, fileName: 'p.pdf', sizeKb: 1, uploadedAt: t() }] }
  let d = base
  const sub = ok(submitRegistration(d, input, { name: 'Zainab Lawal', role: 'cargo_facilitator' }, t()))
  d = ok(districtForward(sub.data, sub.applicationId, ds, '', t())).data
  const approved = ok(directorApprove(d, sub.applicationId, dir, priority, 'Approved', t()))
  expectCleanTrail(approved.data, sub.applicationId, ['registration'])
  return { data: approved.data, facilitator: { name: 'Zainab Lawal', role: 'cargo_facilitator', customerId: approved.customerId }, customerId: approved.customerId }
}

describe('journey: the full happy path', () => {
  it('registration → booking → approvals → payment → dispatch → AWB → amendment → completion', () => {
    const onboarded = onboard(createSeedData(), 'RC 5550101')
    const { facilitator } = onboarded
    let d = onboarded.data
    expect(d.customers.at(-1)).toMatchObject({ accountStatus: 'active', district: 'Lagos', eligibility: { isPriority: true, eligibleDiscountBp: 1000 } })

    const created = ok(createBooking(d, bookingInput(), facilitator, t(), TODAY))
    d = created.data
    const id = created.bookingId
    expect(get(d, id)).toMatchObject({ status: 'pending_hoc_review', payment: { status: 'not_due' } })

    d = ok(hocApproveBooking(d, id, hoc, 'Verified', t())).data
    d = ok(directorApproveBooking(d, id, dir, decision({ discountPct: 8, reason: 'Volume below commitment' }), t())).data
    const approved = get(d, id)
    expect(approved).toMatchObject({ status: 'awaiting_payment', payment: { status: 'pending' } })
    expect(approved.approved!.price.discountBp).toBe(800)

    // an unpaid pay-now booking can never be dispatched
    expect(isReadyForDispatch(approved)).toBe(false)
    expect(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY).ok).toBe(false)

    d = ok(simulatePayment(d, id, 'failure', facilitator, t())).data
    d = ok(simulatePayment(d, id, 'pending', facilitator, t())).data
    d = ok(reconcilePayment(d, id, 'confirm', sa, t())).data
    expect(get(d, id).status).toBe('pending_dispatch')

    const dispatched = ok(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY))
    d = dispatched.data
    expect(get(d, id).status).toBe('awb_generated')
    // repeating the approval returns the same AWB
    const again = ok(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY))
    expect(again).toMatchObject({ existing: true, awbNumber: dispatched.awbNumber })

    d = ok(amendAwb(d, id, { ...dispatchInput, trainNumber: 'LI-FR-22' }, 'Train swapped', hop, t(), TODAY)).data
    expect(get(d, id).awb!.version).toBe(2)
    d = ok(completeBooking(d, id, hop, t())).data

    expect(expectCleanTrail(d, id, ['booking', 'payment'])).toBe('completed')
    // the frozen price is untouched by everything that happened afterwards
    expect(get(d, id).approved!.price.totalPayable).toBe(approved.approved!.price.totalPayable)
  })

  it('credit path: approved on credit, dispatched without payment, settled later; credit threshold respected', () => {
    const { data, facilitator } = onboard(createSeedData(), 'RC 5550102')
    let d = ok(createBooking(data, bookingInput(), facilitator, t(), TODAY)).data
    const id = d.bookings.at(-1)!.id
    d = ok(hocApproveBooking(d, id, hoc, '', t())).data
    d = ok(directorApproveBooking(d, id, dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 2 }), t())).data
    expect(get(d, id)).toMatchObject({ status: 'credit_approved', payment: { status: 'credit_outstanding' } })
    d = ok(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY)).data
    expect(get(d, id).status).toBe('awb_generated')
    expect(settleCredit(d, id, 'success', facilitator, t()).ok).toBe(false) // link not issued yet
    d = ok(issueCreditPaymentLink(d, id, sa, t())).data
    d = ok(settleCredit(d, id, 'success', facilitator, t())).data
    expect(get(d, id).payment.status).toBe('credit_settled')
    expectCleanTrail(d, id, ['booking', 'payment'])
  })
})

describe('journey: send-backs and rejections', () => {
  it('registration send-back loop, then activation', () => {
    const input = { ...demoRegistration(), cacNumber: 'RC 5550103', documents: [{ id: 'd1', kind: 'cac_certificate' as const, fileName: 'c.pdf', sizeKb: 1, uploadedAt: t() }, { id: 'd2', kind: 'company_profile' as const, fileName: 'p.pdf', sizeKb: 1, uploadedAt: t() }] }
    const fac: Actor = { name: 'Zainab Lawal', role: 'cargo_facilitator' }
    const sub = ok(submitRegistration(createSeedData(), input, fac, t()))
    let d = ok(districtSendBack(sub.data, sub.applicationId, ds, 'CAC scan unreadable', t())).data
    d = ok(resubmitRegistration(d, sub.applicationId, input, { ...fac, applicantAppId: sub.applicationId }, t())).data
    d = ok(districtForward(d, sub.applicationId, ds, '', t())).data
    d = ok(directorApprove(d, sub.applicationId, dir, priority, '', t())).data
    expect(expectCleanTrail(d, sub.applicationId, ['registration'])).toBe('activated')
  })

  it('booking: HoC send-back → resubmit → Director send-back → HoC → Director rejects (no payment, no refund)', () => {
    const { data, facilitator } = onboard(createSeedData(), 'RC 5550104')
    let d = ok(createBooking(data, bookingInput(), facilitator, t(), TODAY)).data
    const id = d.bookings.at(-1)!.id
    d = ok(hocSendBackBooking(d, id, hoc, 'Weight mismatch', t())).data
    d = ok(resubmitBooking(d, id, bookingInput({ weightTons: 36 }), facilitator, t(), TODAY)).data
    d = ok(hocApproveBooking(d, id, hoc, '', t())).data
    d = ok(directorSendBackBooking(d, id, dir, 'Check documents again', t())).data
    expect(get(d, id).status).toBe('sent_back_to_hoc')
    d = ok(hocApproveBooking(d, id, hoc, '', t())).data
    d = ok(directorRejectBooking(d, id, dir, 'Capacity unavailable', t())).data
    expect(get(d, id)).toMatchObject({ status: 'rejected_director', payment: { status: 'cancelled' } })
    expect(d.refunds.some((r) => r.bookingId === id)).toBe(false)
    expect(expectCleanTrail(d, id, ['booking', 'payment'])).toBe('rejected_director')
  })

  it('booking: Head of Cargo rejection ends the journey and releases capacity', () => {
    const { data, facilitator } = onboard(createSeedData(), 'RC 5550105')
    let d = ok(createBooking(data, bookingInput(), facilitator, t(), TODAY)).data
    const id = d.bookings.at(-1)!.id
    d = ok(hocRejectBooking(d, id, hoc, 'Wrong consignee', t())).data
    expect(expectCleanTrail(d, id, ['booking', 'payment'])).toBe('rejected_hoc')
    expect(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY).ok).toBe(false)
  })

  it('unpaid booking: reminder, then auto-cancel; it can never be dispatched', () => {
    const { data, facilitator } = onboard(createSeedData(), 'RC 5550106')
    let d = ok(createBooking(data, bookingInput(), facilitator, t(), TODAY)).data
    const id = d.bookings.at(-1)!.id
    d = ok(hocApproveBooking(d, id, hoc, '', t())).data
    d = ok(directorApproveBooking(d, id, dir, decision(), t())).data
    d = ok(autoCancelUnpaid(d, id, sa, t())).data
    expect(get(d, id)).toMatchObject({ status: 'auto_cancelled', payment: { status: 'cancelled' } })
    expect(approveDispatch(d, id, dispatchInput, checks, hop, t(), TODAY).ok).toBe(false)
    expect(simulatePayment(d, id, 'success', facilitator, t()).ok).toBe(false)
    expect(expectCleanTrail(d, id, ['booking', 'payment'])).toBe('auto_cancelled')
  })
})

describe('journey: operational failure and refund', () => {
  it('paid booking fails the physical check → refund triggered, requested, processed, then reversed — original record untouched', () => {
    const { data, facilitator } = onboard(createSeedData(), 'RC 5550107')
    let d = ok(createBooking(data, bookingInput(), facilitator, t(), TODAY)).data
    const id = d.bookings.at(-1)!.id
    d = ok(hocApproveBooking(d, id, hoc, '', t())).data
    d = ok(directorApproveBooking(d, id, dir, decision(), t())).data
    d = ok(simulatePayment(d, id, 'success', facilitator, t())).data
    const failed = ok(failPhysicalVerification(d, id, 'Seal broken; weight 2t above declared', hop, t()))
    d = failed.data
    expect(get(d, id).status).toBe('rejected_physical')
    const refundId = failed.refundId!
    expect(d.refunds.find((r) => r.id === refundId)).toMatchObject({ status: 'awaiting_director', amount: get(d, id).approved!.price.totalPayable })

    d = ok(triggerRefund(d, refundId, dir, t())).data
    d = ok(submitRefundRequest(d, refundId, { bankName: 'Demo Bank', accountName: 'Journey Co', accountNumber: '0123456789', confirmedAmount: d.refunds.find((r) => r.id === refundId)!.amount, policyAcknowledged: true }, facilitator, t())).data
    for (const step of ['review', 'approve', 'process'] as const) d = ok(advanceRefund(d, refundId, step, sa, t())).data
    const processed = JSON.stringify(d.refunds.find((r) => r.id === refundId))
    d = ok(reverseRefund(d, refundId, 'Paid to the wrong account', sa, t())).data
    expect(JSON.stringify(d.refunds.find((r) => r.id === refundId))).toBe(processed)

    expect(expectCleanTrail(d, id, ['booking', 'payment'])).toBe('rejected_physical')
    expect(expectCleanTrail(d, refundId, ['refund'])).toBe('processed')
  })
})

describe('invariants across everything the journeys produced', () => {
  it('audit ids are unique and the seed data itself has a clean registration and booking trail', () => {
    const d = createSeedData()
    expect(new Set(d.audit.map((e) => e.id)).size).toBe(d.audit.length)
    for (const a of d.applications) expectCleanTrail(d, a.id, ['registration'])
    for (const b of d.bookings) expectCleanTrail(d, b.id, ['booking', 'payment'])
    for (const r of d.refunds) expectCleanTrail(d, r.id, ['refund'])
  })
})
