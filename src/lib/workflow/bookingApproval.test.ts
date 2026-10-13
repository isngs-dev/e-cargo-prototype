import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { calculatePrice } from '@/lib/pricing'
import { naira } from '@/lib/money'
import { isPaymentConditionMet, isReadyForDispatch } from '@/lib/status'
import type { AppData, Booking } from '@/types/domain'
import { emptyBooking, resubmitBooking, type BookingInput } from './booking'
import {
  addBookingRemark, directorApproveBooking, directorRejectBooking, directorSendBackBooking, hocApproveBooking, hocRejectBooking, hocSendBackBooking,
  type DirectorDecision,
} from './bookingApproval'
import {
  autoCancelUnpaid, issueCreditPaymentLink, reconcilePayment, sendPaymentReminder, settleCredit, simulatePayment,
} from './payment'
import type { Actor, WorkflowResult } from './result'

const NOW = '2026-10-13T12:00:00+01:00'
const hoc: Actor = { name: 'Funmilayo Adebayo', role: 'head_of_cargo' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }
const hop: Actor = { name: 'Grace Etim', role: 'head_port_operations' }
const lagoon: Actor = { name: 'Adaeze Okafor', role: 'cargo_facilitator', customerId: 'cus-lagoon' }
const gateway: Actor = { name: 'Ibrahim Musa', role: 'cargo_facilitator', customerId: 'cus-gateway' }

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}
const get = (d: AppData, id: string): Booking => d.bookings.find((b) => b.id === id)!
const decision = (patch: Partial<DirectorDecision> = {}): DirectorDecision => ({ discountPct: 10, paymentTerms: 'pay_now', creditMonths: 0, reason: '', remarks: '', ...patch })

// seed: bk-0418 = Lagoon (Priority 10%, 2 months), pending HoC. bk-0419 = Gateway (Non-Priority), pending HoC.
const atDirector = (id: string) => ok(hocApproveBooking(createSeedData(), id, hoc, '', NOW)).data

describe('Head of Cargo', () => {
  it('approves and forwards to the Director', () => {
    const r = ok(hocApproveBooking(createSeedData(), 'bk-0418', hoc, 'All documents verified', NOW))
    expect(get(r.data, 'bk-0418').status).toBe('pending_director_review')
    expect(r.data.audit.at(-1)).toMatchObject({ fromStatus: 'pending_hoc_review', toStatus: 'pending_director_review', actorRole: 'head_of_cargo' })
  })
  it('needs remarks to send back or reject; rejection is a no-refund ending', () => {
    const d = createSeedData()
    expect(hocSendBackBooking(d, 'bk-0418', hoc, ' ').ok).toBe(false)
    expect(hocRejectBooking(d, 'bk-0418', hoc, '').ok).toBe(false)
    expect(get(ok(hocSendBackBooking(d, 'bk-0418', hoc, 'Weight mismatch')).data, 'bk-0418').status).toBe('sent_back_to_facilitator')
    const rej = get(ok(hocRejectBooking(d, 'bk-0418', hoc, 'Wrong consignee')).data, 'bk-0418')
    expect(rej.status).toBe('rejected_hoc')
    expect(rej.payment.status).toBe('cancelled')
  })
  it('cannot be done by other roles, or at the wrong stage', () => {
    const d = createSeedData()
    expect(hocApproveBooking(d, 'bk-0418', dir).ok).toBe(false)
    expect(hocApproveBooking(d, 'bk-0418', sa).ok).toBe(false)
    expect(hocApproveBooking(d, 'bk-0412', hoc).ok).toBe(false) // already at Director
  })
})

describe('Director approval — discount rules', () => {
  it('Priority: grants up to the eligible maximum, never above', () => {
    expect(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision({ discountPct: 12 }), NOW).ok).toBe(false)
    expect(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision({ discountPct: 10 }), NOW).ok).toBe(true)
  })
  it('requires a reason when granting below the maximum, and audits it', () => {
    const d = atDirector('bk-0418')
    expect(directorApproveBooking(d, 'bk-0418', dir, decision({ discountPct: 8 }), NOW).ok).toBe(false)
    const r = ok(directorApproveBooking(d, 'bk-0418', dir, decision({ discountPct: 8, reason: 'Below committed volume' }), NOW))
    const entry = r.data.audit.find((e) => e.action === 'Discount granted below eligible maximum')!
    expect(entry).toMatchObject({ remarks: 'Below committed volume', change: { field: 'Booking discount', from: '10%', to: '8%' }, actorRole: 'director_operations' })
  })
  it('Non-Priority: no booking-level discount can be created', () => {
    const d = atDirector('bk-0419')
    expect(directorApproveBooking(d, 'bk-0419', dir, decision({ discountPct: 5 }), NOW).ok).toBe(false)
    const r = ok(directorApproveBooking(d, 'bk-0419', dir, decision({ discountPct: 0 }), NOW))
    expect(get(r.data, 'bk-0419').approved!.price.totalPayable).toBe(naira(197_550))
  })
})

describe('Director approval — price freeze and terms', () => {
  it('freezes the recalculated price with an eligibility snapshot', () => {
    const d = atDirector('bk-0418')
    const r = ok(directorApproveBooking(d, 'bk-0418', dir, decision({ discountPct: 8, reason: 'x' }), NOW))
    const b = get(r.data, 'bk-0418')
    expect(b.approved!.price.discountBp).toBe(800)
    expect(b.approved!.price.totalPayable).not.toBe(b.indicativePrice.totalPayable)
    expect(b.approved!.eligibilitySnapshot).toMatchObject({ isPriority: true, eligibleDiscountBp: 1000 })
    expect(b.indicativePrice.discountBp).toBe(1000) // indicative stays as shown to the facilitator
  })
  it('Pay Now → Awaiting Payment with a simulated invoice and link, due after the configured window', () => {
    const b = get(ok(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision(), NOW)).data, 'bk-0418')
    expect(b.status).toBe('awaiting_payment')
    expect(b.payment).toMatchObject({ status: 'pending', invoiceNumber: 'INV-2026-0418', reference: 'DEMO-PSK-0418' })
    expect(new Date(b.payment.dueBy!).getTime() - new Date(NOW).getTime()).toBe(72 * 3_600_000)
  })
  it('Pay After Credit → Credit Approved, limited to the eligible period and to Priority customers', () => {
    const d = atDirector('bk-0418')
    expect(directorApproveBooking(d, 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 3 }), NOW).ok).toBe(false)
    expect(directorApproveBooking(d, 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 0 }), NOW).ok).toBe(false)
    const b = get(ok(directorApproveBooking(d, 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 2 }), NOW)).data, 'bk-0418')
    expect(b).toMatchObject({ status: 'credit_approved', payment: { status: 'credit_outstanding' } })
    expect(b.payment.dueBy!.slice(0, 10)).toBe('2026-12-13')
    const ng = atDirector('bk-0419')
    expect(directorApproveBooking(ng, 'bk-0419', dir, decision({ discountPct: 0, paymentTerms: 'pay_after_credit', creditMonths: 1 }), NOW).ok).toBe(false)
  })
  it('audits the payment-term selection', () => {
    const r = ok(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 2 }), NOW))
    expect(r.data.audit.some((e) => e.action === 'Payment terms selected' && e.change?.to.includes('2-month'))).toBe(true)
  })
  it('blocks credit that would exceed the customer threshold', () => {
    const d = atDirector('bk-0418')
    d.customers.find((c) => c.id === 'cus-lagoon')!.eligibility.creditThreshold = naira(400_000) // seed outstanding credit already ~₦330k+
    expect(directorApproveBooking(d, 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 1 }), NOW).ok).toBe(false)
    expect(directorApproveBooking(d, 'bk-0418', dir, decision(), NOW).ok).toBe(true) // pay now still possible
  })
  it('blocks approval for suspended customers and for unpriceable bookings', () => {
    const d = atDirector('bk-0418')
    d.customers.find((c) => c.id === 'cus-lagoon')!.accountStatus = 'suspended'
    expect(directorApproveBooking(d, 'bk-0418', dir, decision(), NOW).ok).toBe(false)
    const d2 = atDirector('bk-0418')
    d2.freightRates = d2.freightRates.filter((r) => r.routeId !== 'rt-ebm')
    const r = directorApproveBooking(d2, 'bk-0418', dir, decision(), NOW)
    expect(!r.ok && r.error).toMatch(/No freight rate/)
  })
  it('later eligibility changes never alter an approved booking', () => {
    const r = ok(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision(), NOW)).data
    const before = JSON.stringify(get(r, 'bk-0418').approved)
    const c = r.customers.find((x) => x.id === 'cus-lagoon')!
    c.eligibility = { ...c.eligibility, isPriority: false, eligibleDiscountBp: 0 }
    expect(JSON.stringify(get(r, 'bk-0418').approved)).toBe(before)
    // and the frozen total equals a fresh calculation with the approved 10% discount
    const fresh = calculatePrice({ routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }], bookingDate: '2026-10-20', discountBp: 1000 }, r.freightRates, r.config.tax)
    expect(get(r, 'bk-0418').approved!.price.totalPayable).toBe(fresh.totalPayable)
  })
  it('only the Director decides, only at the Director stage', () => {
    const d = createSeedData()
    expect(directorApproveBooking(d, 'bk-0418', dir, decision(), NOW).ok).toBe(false) // still with HoC
    expect(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', sa, decision(), NOW).ok).toBe(false)
    expect(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', hoc, decision(), NOW).ok).toBe(false)
  })
})

describe('Director reject / send back', () => {
  it('requires remarks; rejection ends with no refund', () => {
    const d = atDirector('bk-0418')
    expect(directorRejectBooking(d, 'bk-0418', dir, '').ok).toBe(false)
    expect(get(ok(directorRejectBooking(d, 'bk-0418', dir, 'Capacity unavailable')).data, 'bk-0418').status).toBe('rejected_director')
  })
  it('sends back to Head of Cargo, who can approve again', () => {
    const d = atDirector('bk-0418')
    expect(directorSendBackBooking(d, 'bk-0418', dir, ' ').ok).toBe(false)
    const back = ok(directorSendBackBooking(d, 'bk-0418', dir, 'Check hazardous docs')).data
    expect(get(back, 'bk-0418').status).toBe('sent_back_to_hoc')
    expect(get(ok(hocApproveBooking(back, 'bk-0418', hoc)).data, 'bk-0418').status).toBe('pending_director_review')
  })
})

describe('internal remarks and resubmission', () => {
  it('internal remarks are for NRC reviewers only and are flagged internal', () => {
    const d = createSeedData()
    expect(addBookingRemark(d, 'bk-0418', lagoon, 'hi').ok).toBe(false)
    expect(addBookingRemark(d, 'bk-0418', hoc, ' ').ok).toBe(false)
    expect(ok(addBookingRemark(d, 'bk-0418', hoc, 'Called the facilitator')).data.audit.at(-1)).toMatchObject({ internal: true })
  })
  it('facilitator corrects and resubmits a sent-back booking, keeping the reference', () => {
    const d = createSeedData() // bk-0395 is sent back (Northbound)
    const northbound: Actor = { name: 'Bola Ajayi', role: 'cargo_facilitator', customerId: 'cus-northbound' }
    const b = get(d, 'bk-0395')
    const input: BookingInput = {
      ...emptyBooking(), bookingDate: '2026-10-25', cargoType: b.cargoType, routeId: b.routeId, containers: b.containers, weightTons: 92,
      commodity: b.commodity, documents: b.documents, declaration: true,
    }
    expect(resubmitBooking(d, 'bk-0395', input, lagoon, NOW, '2026-10-13').ok).toBe(false) // not the owner
    expect(resubmitBooking(d, 'bk-0418', input, lagoon, NOW, '2026-10-13').ok).toBe(false) // wrong status
    const r = ok(resubmitBooking(d, 'bk-0395', input, northbound, NOW, '2026-10-13'))
    expect(get(r.data, 'bk-0395')).toMatchObject({ status: 'pending_hoc_review', reference: 'NRC-BK-2026-0395', weightTons: 92 })
    expect(r.data.audit.at(-1)).toMatchObject({ fromStatus: 'sent_back_to_facilitator', toStatus: 'pending_hoc_review' })
  })
})

describe('simulated payment', () => {
  const awaiting = () => ok(directorApproveBooking(atDirector('bk-0419'), 'bk-0419', dir, decision({ discountPct: 0 }), NOW)).data

  it('success moves the booking to Pending Dispatch and satisfies the dispatch gate', () => {
    const d = awaiting()
    expect(isReadyForDispatch(get(d, 'bk-0419'))).toBe(false)
    const r = ok(simulatePayment(d, 'bk-0419', 'success', gateway, NOW)).data
    const b = get(r, 'bk-0419')
    expect(b).toMatchObject({ status: 'pending_dispatch', payment: { status: 'paid' } })
    expect(isPaymentConditionMet(b)).toBe(true)
    expect(isReadyForDispatch(b)).toBe(true)
    expect(r.audit.at(-1)!.action).toMatch(/simulated/)
  })
  it('failure keeps the booking unpaid and not dispatchable, and allows a retry', () => {
    const failed = ok(simulatePayment(awaiting(), 'bk-0419', 'failure', gateway, NOW)).data
    expect(get(failed, 'bk-0419')).toMatchObject({ status: 'awaiting_payment', payment: { status: 'failed' } })
    expect(isReadyForDispatch(get(failed, 'bk-0419'))).toBe(false)
    expect(get(ok(simulatePayment(failed, 'bk-0419', 'success', gateway, NOW)).data, 'bk-0419').status).toBe('pending_dispatch')
  })
  it('pending is reconciled by Super Admin only', () => {
    const processing = ok(simulatePayment(awaiting(), 'bk-0419', 'pending', gateway, NOW)).data
    expect(get(processing, 'bk-0419').payment.status).toBe('processing')
    expect(simulatePayment(processing, 'bk-0419', 'success', gateway, NOW).ok).toBe(false) // already in flight
    expect(reconcilePayment(processing, 'bk-0419', 'confirm', dir, NOW).ok).toBe(false)
    expect(get(ok(reconcilePayment(processing, 'bk-0419', 'confirm', sa, NOW)).data, 'bk-0419').status).toBe('pending_dispatch')
    expect(get(ok(reconcilePayment(processing, 'bk-0419', 'fail', sa, NOW)).data, 'bk-0419').payment.status).toBe('failed')
  })
  it('only the booking’s own facilitator can pay, and only when awaiting payment', () => {
    const d = awaiting()
    expect(simulatePayment(d, 'bk-0419', 'success', lagoon, NOW).ok).toBe(false)
    expect(simulatePayment(d, 'bk-0419', 'success', hop, NOW).ok).toBe(false)
    expect(simulatePayment(createSeedData(), 'bk-0418', 'success', lagoon, NOW).ok).toBe(false)
  })
  it('reminder and auto-cancel are Super Admin demo controls; auto-cancel respects in-flight and paid payments', () => {
    const d = awaiting()
    expect(sendPaymentReminder(d, 'bk-0419', gateway, NOW).ok).toBe(false)
    expect(get(ok(sendPaymentReminder(d, 'bk-0419', sa, NOW)).data, 'bk-0419').payment.reminderSentAt).toBe(NOW)
    expect(autoCancelUnpaid(d, 'bk-0419', gateway, NOW).ok).toBe(false)
    const cancelled = ok(autoCancelUnpaid(d, 'bk-0419', sa, NOW)).data
    expect(get(cancelled, 'bk-0419')).toMatchObject({ status: 'auto_cancelled', payment: { status: 'cancelled' } })
    expect(cancelled.audit.at(-1)).toMatchObject({ actorRole: 'system', toStatus: 'auto_cancelled' })
    const processing = ok(simulatePayment(d, 'bk-0419', 'pending', gateway, NOW)).data
    expect(autoCancelUnpaid(processing, 'bk-0419', sa, NOW).ok).toBe(false)
    expect(autoCancelUnpaid(ok(simulatePayment(d, 'bk-0419', 'success', gateway, NOW)).data, 'bk-0419', sa, NOW).ok).toBe(false)
  })
})

describe('credit', () => {
  const credit = () => ok(directorApproveBooking(atDirector('bk-0418'), 'bk-0418', dir, decision({ paymentTerms: 'pay_after_credit', creditMonths: 2 }), NOW)).data

  it('a credit-approved booking satisfies the dispatch gate without payment', () => {
    expect(isReadyForDispatch(get(credit(), 'bk-0418'))).toBe(true)
  })
  it('the payment link is issued at credit end; settlement only afterwards, by the facilitator', () => {
    const d = credit()
    expect(settleCredit(d, 'bk-0418', 'success', lagoon, NOW).ok).toBe(false) // link not yet issued
    expect(issueCreditPaymentLink(d, 'bk-0418', lagoon, NOW).ok).toBe(false)
    const issued = ok(issueCreditPaymentLink(d, 'bk-0418', sa, NOW)).data
    expect(issueCreditPaymentLink(issued, 'bk-0418', sa, NOW).ok).toBe(false)
    expect(settleCredit(issued, 'bk-0418', 'success', gateway, NOW).ok).toBe(false) // someone else's booking
    const failed = ok(settleCredit(issued, 'bk-0418', 'failure', lagoon, NOW)).data
    expect(get(failed, 'bk-0418').payment.status).toBe('credit_outstanding')
    expect(get(ok(settleCredit(issued, 'bk-0418', 'success', lagoon, NOW)).data, 'bk-0418').payment.status).toBe('credit_settled')
  })
})
