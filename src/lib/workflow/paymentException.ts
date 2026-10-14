import type { AppData, PaymentExceptionAction } from '@/types/domain'
import { formatKobo } from '@/lib/money'
import { appendAudit } from './audit'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Payment exception queue (baseline §4.4): unmatched or duplicate payments routed to Super Admin.
 * Resolution is simulated; no gateway is contacted and no money moves.
 *  - matched: apply the payment to an open invoice whose total equals the amount received;
 *  - duplicate_refund: start the refund flow (Director triggers, Super Admin processes) — open item D-13 covers the full policy;
 *  - returned: record that the payment is returned to the sender.
 */

export type Resolution = { action: 'matched'; bookingId: string } | { action: 'duplicate_refund' } | { action: 'returned' }

/** Open invoices a received amount can be applied to. */
export function matchableBookings(data: AppData, amount: number) {
  return data.bookings.filter((b) => b.status === 'awaiting_payment' && !!b.approved && ['pending', 'failed', 'processing'].includes(b.payment.status) && b.approved.price.totalPayable === amount)
}

export function resolvePaymentException(data: AppData, id: string, resolution: Resolution, note: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Only Super Admin resolves payment exceptions.')
  if (!note.trim()) return fail('A resolution note is required.')
  const next = structuredClone(data)
  const px = next.paymentExceptions.find((p) => p.id === id)
  if (!px) return fail('Payment exception not found.')
  if (px.resolved) return fail('This exception is already resolved.')
  let bookingId: string | undefined
  let action: string

  if (resolution.action === 'matched') {
    const b = next.bookings.find((x) => x.id === resolution.bookingId)
    if (!b || !matchableBookings(next, px.amount).some((m) => m.id === b.id)) return fail(`Select an open invoice for exactly ${formatKobo(px.amount)}.`)
    const from = b.status
    b.payment = { ...b.payment, status: 'paid', paidAt: now }
    b.status = 'pending_dispatch'
    b.updatedAt = now
    bookingId = b.id
    action = `Payment ${px.reference} matched to ${b.reference} and confirmed (simulated reconciliation)`
    appendAudit(next, { at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference, action, fromStatus: from, toStatus: 'pending_dispatch', remarks: note.trim() })
  } else if (resolution.action === 'duplicate_refund') {
    const b = px.bookingId ? next.bookings.find((x) => x.id === px.bookingId) : undefined
    if (!b) return fail('This payment is not linked to a booking, so a duplicate refund cannot be started.')
    const refundId = `rf-${px.id}`
    if (next.refunds.some((r) => r.id === refundId)) return fail('A refund was already started for this payment.')
    next.refunds.push({ id: refundId, bookingId: b.id, customerId: b.customerId, amount: px.amount, reason: `Duplicate payment received (${px.reference}).`, status: 'awaiting_director', createdAt: now })
    bookingId = b.id
    action = `Duplicate payment ${px.reference}: refund flow started for ${b.reference} (Director to trigger)`
  } else {
    action = `Payment ${px.reference} returned to sender (simulated)`
  }

  px.resolved = true
  px.resolution = { action: resolution.action as PaymentExceptionAction, note: note.trim(), at: now, byName: actor.name, bookingId }
  appendAudit(next, { at: now, actorName: actor.name, actorRole: actor.role, entityType: 'payment', entityId: px.id, entityRef: px.reference, action, remarks: note.trim() })
  return { ok: true, data: next }
}
