import type { AppData, Booking, BookingStatus, PaymentTerms, Role } from '@/types/domain'
import {
  discountReductionNeedsReason, outstandingCredit, validateFinalDiscount, validatePaymentTerms,
} from '@/lib/eligibility'
import { formatBp, formatKobo } from '@/lib/money'
import { tryCalculatePrice } from '@/lib/pricing'
import { appendAudit } from './audit'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Booking approvals (baseline §4.2, §4.3, §9). Pure functions: (data, input) → new data or an error.
 * Head of Cargo verifies and forwards; the Director makes the final decision, sets the final discount
 * (downward only, within eligibility) and payment terms, and the price is frozen at that moment.
 * Invoices, payment links and emails are simulated.
 */

const HOC_QUEUE: BookingStatus[] = ['pending_hoc_review', 'sent_back_to_hoc']

function load(data: AppData, id: string, actor: Actor, role: Role, statuses: BookingStatus[], verb: string) {
  if (actor.role !== role) return fail(`Only the ${role.replace(/_/g, ' ')} can ${verb}.`)
  const next = structuredClone(data)
  const booking = next.bookings.find((b) => b.id === id)
  if (!booking) return fail('Booking not found.')
  if (!statuses.includes(booking.status)) return fail(`Cannot ${verb}: booking is "${booking.status.replace(/_/g, ' ')}".`)
  return { next, booking }
}

function move(next: AppData, b: Booking, actor: Actor, to: BookingStatus, action: string, now: string, remarks?: string) {
  const from = b.status
  b.status = to
  b.updatedAt = now
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action, fromStatus: from, toStatus: to, remarks,
  })
}

const needRemarks = (remarks: string | undefined, what: string) => (remarks?.trim() ? null : fail(`${what} requires remarks.`))

// ------------------------------------------------------------ Head of Cargo

export function hocApproveBooking(data: AppData, id: string, actor: Actor, remarks = '', now = new Date().toISOString()): WorkflowResult {
  const loaded = load(data, id, actor, 'head_of_cargo', HOC_QUEUE, 'approve this booking')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.booking, actor, 'pending_director_review', 'Documents and cargo verified; forwarded to Director', now, remarks.trim() || undefined)
  return { ok: true, data: loaded.next }
}

export function hocSendBackBooking(data: AppData, id: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = needRemarks(remarks, 'Sending back')
  if (r) return r
  const loaded = load(data, id, actor, 'head_of_cargo', HOC_QUEUE, 'send back this booking')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.booking, actor, 'sent_back_to_facilitator', 'Sent back to facilitator (email simulated)', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

export function hocRejectBooking(data: AppData, id: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = needRemarks(remarks, 'Rejecting')
  if (r) return r
  const loaded = load(data, id, actor, 'head_of_cargo', HOC_QUEUE, 'reject this booking')
  if ('error' in loaded) return loaded
  loaded.booking.payment = { status: 'cancelled' }
  move(loaded.next, loaded.booking, actor, 'rejected_hoc', 'Rejected (email simulated). No payment was taken; no refund required', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

// ------------------------------------------------------------ Director

export interface DirectorDecision {
  /** Final discount in percent (Priority only; must be 0 for Non-Priority). */
  discountPct: number
  paymentTerms: PaymentTerms
  creditMonths: number
  /** Required when the discount is below the customer's eligible maximum. */
  reason: string
  remarks: string
}

const addHours = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
const addMonths = (iso: string, months: number) => {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export function directorApproveBooking(data: AppData, id: string, actor: Actor, input: DirectorDecision, now = new Date().toISOString()): WorkflowResult {
  const loaded = load(data, id, actor, 'director_operations', ['pending_director_review'], 'approve this booking')
  if ('error' in loaded) return loaded
  const { next, booking } = loaded
  const customer = next.customers.find((c) => c.id === booking.customerId)
  if (!customer) return fail('Customer account not found.')
  if (customer.accountStatus !== 'active') return fail(`Customer account is ${customer.accountStatus}. The booking cannot be approved.`)
  const e = customer.eligibility

  if (!Number.isFinite(input.discountPct)) return fail('Enter the final discount (0 if none).')
  const bp = Math.round(input.discountPct * 100)
  const discountCheck = validateFinalDiscount(e, bp)
  if (!discountCheck.ok) return fail(discountCheck.reason)
  if (discountReductionNeedsReason(e, bp) && !input.reason.trim()) {
    return fail(`A reason is required when granting less than the eligible ${formatBp(e.eligibleDiscountBp)} discount.`)
  }
  const credit = input.paymentTerms === 'pay_after_credit' ? input.creditMonths : 0
  const termsCheck = validatePaymentTerms(e, input.paymentTerms, credit)
  if (!termsCheck.ok) return fail(termsCheck.reason)

  // Final price is calculated once, here, and frozen. Missing rates block approval — never a ₦0 price.
  const priced = tryCalculatePrice(
    { routeId: booking.routeId, cargoType: booking.cargoType, containers: booking.containers, bookingDate: booking.bookingDate, discountBp: bp },
    next.freightRates, next.config.tax,
  )
  if (!priced.ok) return fail(priced.error)
  const price = priced.price

  if (input.paymentTerms === 'pay_after_credit') {
    const outstanding = outstandingCredit(next.bookings, customer.id)
    if (outstanding + price.totalPayable > e.creditThreshold) {
      return fail(`Approving on credit would take outstanding credit to ${formatKobo(outstanding + price.totalPayable)}, above the ${formatKobo(e.creditThreshold)} threshold. Choose "Payment link now" or reject.`)
    }
  }

  const digits = booking.reference.slice(-4)
  const payNow = input.paymentTerms === 'pay_now'
  booking.approved = {
    price, paymentTerms: input.paymentTerms, creditMonths: credit, approvedAt: now, eligibilitySnapshot: structuredClone(e),
  }
  booking.payment = payNow
    ? { status: 'pending', dueBy: addHours(now, next.config.paymentWindowHours), reference: `DEMO-PSK-${digits}`, invoiceNumber: `INV-2026-${digits}` }
    : { status: 'credit_outstanding', dueBy: addMonths(now, credit), invoiceNumber: `INV-2026-${digits}` }

  const remarks = input.remarks.trim() || undefined
  move(next, booking, actor, payNow ? 'awaiting_payment' : 'credit_approved',
    payNow ? `Approved — payment link issued (simulated, Paystack not contacted); price frozen at ${formatKobo(price.totalPayable)}`
      : `Approved on ${credit}-month credit; invoice generated (simulated); price frozen at ${formatKobo(price.totalPayable)}`, now, remarks)

  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: booking.id, entityRef: booking.reference,
    action: 'Payment terms selected', remarks,
    change: { field: 'Payment terms', from: '—', to: payNow ? 'Payment link now' : `Payment link after ${credit}-month credit period` },
  })
  if (discountReductionNeedsReason(e, bp)) {
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: booking.id, entityRef: booking.reference,
      action: 'Discount granted below eligible maximum', remarks: input.reason.trim(),
      change: { field: 'Booking discount', from: formatBp(e.eligibleDiscountBp), to: formatBp(bp) },
    })
  }
  return { ok: true, data: next }
}

export function directorRejectBooking(data: AppData, id: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = needRemarks(remarks, 'Rejecting')
  if (r) return r
  const loaded = load(data, id, actor, 'director_operations', ['pending_director_review'], 'reject this booking')
  if ('error' in loaded) return loaded
  loaded.booking.payment = { status: 'cancelled' }
  move(loaded.next, loaded.booking, actor, 'rejected_director', 'Rejected (email simulated). No payment was taken; no refund required', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

export function directorSendBackBooking(data: AppData, id: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = needRemarks(remarks, 'Sending back')
  if (r) return r
  const loaded = load(data, id, actor, 'director_operations', ['pending_director_review'], 'send back this booking')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.booking, actor, 'sent_back_to_hoc', 'Sent back to Head of Cargo', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

// ------------------------------------------------------------ Internal remarks

export function addBookingRemark(data: AppData, id: string, actor: Actor, remark: string, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'head_of_cargo' && actor.role !== 'director_operations') return fail('Only NRC reviewers can add internal remarks.')
  if (!remark.trim()) return fail('Enter a remark.')
  const next = structuredClone(data)
  const b = next.bookings.find((x) => x.id === id)
  if (!b) return fail('Booking not found.')
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: 'Internal remark added', remarks: remark.trim(), internal: true,
  })
  return { ok: true, data: next }
}
