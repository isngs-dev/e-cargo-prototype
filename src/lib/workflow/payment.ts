import type { AppData, Booking } from '@/types/domain'
import { formatKobo } from '@/lib/money'
import { appendAudit, SYSTEM_ACTOR } from './audit'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Simulated payment & credit (baseline §4.4). Nothing here contacts Paystack or moves money.
 * Payment confirmation in production comes only from a verified webhook / server-side verification —
 * in the prototype the facilitator (or the Super Admin reconciliation action) chooses the simulated outcome.
 */

export type PaymentOutcome = 'success' | 'failure' | 'pending'

function find(data: AppData, id: string) {
  const next = structuredClone(data)
  const booking = next.bookings.find((b) => b.id === id)
  return { next, booking }
}

function owns(actor: Actor, b: Booking) {
  return actor.role === 'cargo_facilitator' && !!actor.customerId && actor.customerId === b.customerId
}

function sys(next: AppData, b: Booking, now: string, action: string, remarks?: string, status?: { from: string; to: string }) {
  appendAudit(next, {
    at: now, ...SYSTEM_ACTOR, entityType: 'payment', entityId: b.id, entityRef: b.reference, action, remarks,
    fromStatus: status?.from, toStatus: status?.to,
  })
}

/** Facilitator attempts to pay the simulated payment link (Payment-Link-Now bookings). */
export function simulatePayment(data: AppData, id: string, outcome: PaymentOutcome, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (!owns(actor, b)) return fail('Only the booking’s facilitator can pay this booking.')
  if (b.status !== 'awaiting_payment' || !b.approved) return fail('This booking is not awaiting payment.')
  if (b.payment.status !== 'pending' && b.payment.status !== 'failed') return fail('A payment is already being processed or has completed.')

  const total = formatKobo(b.approved.price.totalPayable)
  if (outcome === 'success') {
    b.payment = { ...b.payment, status: 'paid', paidAt: now }
    b.status = 'pending_dispatch'
    b.updatedAt = now
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
      action: `Payment of ${total} confirmed (simulated reconciliation — no money moved)`, fromStatus: 'awaiting_payment', toStatus: 'pending_dispatch',
      remarks: `Ref ${b.payment.reference}`,
    })
  } else if (outcome === 'failure') {
    b.payment = { ...b.payment, status: 'failed' }
    b.updatedAt = now
    sys(next, b, now, 'Payment attempt failed (simulated)', 'Card declined by issuer (demo outcome). The payment link remains valid until the window elapses.')
  } else {
    b.payment = { ...b.payment, status: 'processing' }
    b.updatedAt = now
    sys(next, b, now, 'Payment submitted — awaiting gateway confirmation (simulated)', 'Reconciliation by Super Admin or the verified webhook (simulated).')
  }
  return { ok: true, data: next }
}

/** Super Admin reconciliation of a payment stuck in "processing" (simulated webhook / verification call). */
export function reconcilePayment(data: AppData, id: string, decision: 'confirm' | 'fail', actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Only Super Admin can reconcile payments.')
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (b.status !== 'awaiting_payment' || b.payment.status !== 'processing') return fail('No payment is awaiting reconciliation on this booking.')
  if (decision === 'confirm') {
    b.payment = { ...b.payment, status: 'paid', paidAt: now }
    b.status = 'pending_dispatch'
    b.updatedAt = now
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
      action: 'Payment reconciled and confirmed (simulated webhook)', fromStatus: 'awaiting_payment', toStatus: 'pending_dispatch', remarks: `Ref ${b.payment.reference}`,
    })
  } else {
    b.payment = { ...b.payment, status: 'failed' }
    b.updatedAt = now
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
      action: 'Payment reconciliation: not received (simulated)', remarks: 'Marked failed; facilitator may retry the payment link.',
    })
  }
  return { ok: true, data: next }
}

/** Demo control: the 24-hour reminder that the system would send. */
export function sendPaymentReminder(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Demo controls are available to Super Admin only.')
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (b.status !== 'awaiting_payment' || (b.payment.status !== 'pending' && b.payment.status !== 'failed')) return fail('No unpaid payment link on this booking.')
  b.payment = { ...b.payment, reminderSentAt: now }
  sys(next, b, now, 'Payment reminder sent after 24h (email simulated)', 'Triggered via demo control.')
  return { ok: true, data: next }
}

/** Demo control: the configured payment window elapses, the booking is auto-cancelled and capacity released. */
export function autoCancelUnpaid(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Demo controls are available to Super Admin only.')
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (b.status !== 'awaiting_payment') return fail('Only bookings awaiting payment can be auto-cancelled.')
  if (b.payment.status === 'processing') return fail('A payment is being processed — reconcile it first.')
  if (b.payment.status === 'paid') return fail('The booking is already paid.')
  b.status = 'auto_cancelled'
  b.payment = { ...b.payment, status: 'cancelled' }
  b.updatedAt = now
  sys(next, b, now, `Auto-cancelled — payment window (${next.config.paymentWindowHours}h, proposed) elapsed; capacity released`, 'Triggered via demo control. No payment was received, so no refund applies.', { from: 'awaiting_payment', to: 'auto_cancelled' })
  return { ok: true, data: next }
}

/** Demo control: credit period ends and the payment link is issued for the outstanding balance. */
export function issueCreditPaymentLink(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Demo controls are available to Super Admin only.')
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (b.payment.status !== 'credit_outstanding') return fail('This booking has no outstanding credit.')
  if (b.payment.linkIssuedAt) return fail('The payment link has already been issued.')
  b.payment = { ...b.payment, linkIssuedAt: now, reference: b.payment.reference ?? `DEMO-PSK-${b.reference.slice(-4)}` }
  b.updatedAt = now
  sys(next, b, now, 'Credit period ended — payment link issued for the outstanding balance (simulated)', 'Triggered via demo control.')
  return { ok: true, data: next }
}

/** Facilitator pays the credit-period payment link. */
export function settleCredit(data: AppData, id: string, outcome: 'success' | 'failure', actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const { next, booking: b } = find(data, id)
  if (!b) return fail('Booking not found.')
  if (!owns(actor, b)) return fail('Only the booking’s facilitator can settle this credit.')
  if (b.payment.status !== 'credit_outstanding') return fail('This booking has no outstanding credit.')
  if (!b.payment.linkIssuedAt) return fail('The payment link is issued only at the end of the credit period.')
  if (outcome === 'success') {
    b.payment = { ...b.payment, status: 'credit_settled', paidAt: now }
    b.updatedAt = now
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
      action: 'Credit balance settled (simulated — no money moved)', remarks: `Ref ${b.payment.reference}`,
    })
  } else {
    sys(next, b, now, 'Credit settlement attempt failed (simulated)', 'The payment link remains valid.')
  }
  return { ok: true, data: next }
}
