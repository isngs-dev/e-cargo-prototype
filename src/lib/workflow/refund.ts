import type { AppData, Kobo, Refund, RefundStatus } from '@/types/domain'
import { formatKobo } from '@/lib/money'
import { appendAudit } from './audit'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Refund flow (baseline §5): Head of Port rejects → Director triggers the refund link → facilitator submits a request
 * → Super Admin verifies and processes. The Director triggers, Super Admin executes — never the same party.
 * Everything is simulated: no bank details are stored (masked reference only) and no gateway is contacted.
 * Not built: reversal entries, and refunds triggered by cancellation / duplicate payment (open item D-13).
 */

export const refundSteps: { status: RefundStatus; label: string }[] = [
  { status: 'awaiting_director', label: 'Awaiting Director' },
  { status: 'link_sent', label: 'Refund link sent' },
  { status: 'requested', label: 'Requested' },
  { status: 'under_review', label: 'Under review' },
  { status: 'approved', label: 'Approved' },
  { status: 'processed', label: 'Processed' },
]

function loadRefund(data: AppData, id: string, actor: Actor, role: Actor['role'], status: RefundStatus, verb: string) {
  if (actor.role !== role) return fail(`Only the ${role.replace(/_/g, ' ')} can ${verb}.`)
  const next = structuredClone(data)
  const refund = next.refunds.find((r) => r.id === id)
  if (!refund) return fail('Refund not found.')
  if (refund.status !== status) return fail(`Cannot ${verb}: refund is "${refund.status.replace(/_/g, ' ')}".`)
  const booking = next.bookings.find((b) => b.id === refund.bookingId)
  return { next, refund, ref: booking?.reference ?? refund.bookingId }
}

function record(next: AppData, refund: Refund, ref: string, actor: { name: string; role: Actor['role'] }, action: string, to: RefundStatus, from: RefundStatus, now: string, remarks?: string) {
  refund.status = to
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'refund', entityId: refund.id, entityRef: `Refund · ${ref}`,
    action, fromStatus: from, toStatus: to, remarks,
  })
}

export function triggerRefund(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadRefund(data, id, actor, 'director_operations', 'awaiting_director', 'trigger this refund')
  if ('error' in loaded) return loaded
  const { next, refund, ref } = loaded
  refund.linkSentAt = now
  record(next, refund, ref, actor, 'Refund link triggered; rejection reason and refund request form emailed to the facilitator (simulated)', 'link_sent', 'awaiting_director', now, refund.reason)
  return { ok: true, data: next }
}

export interface RefundRequestInput {
  bankName: string
  accountName: string
  /** Simulated: 10 digits are accepted but only the last four are kept. */
  accountNumber: string
  confirmedAmount: Kobo
  policyAcknowledged: boolean
}

export function validateRefundRequest(i: RefundRequestInput, refund: Pick<Refund, 'amount'>): string | null {
  if (!i.bankName.trim()) return 'Enter the bank name.'
  if (!i.accountName.trim()) return 'Enter the account name.'
  if (!/^\d{10}$/.test(i.accountNumber.trim())) return 'Enter a 10-digit account number (demo only — do not enter a real account).'
  if (i.confirmedAmount !== refund.amount) return `The confirmed amount must equal the refund amount of ${formatKobo(refund.amount)}.`
  if (!i.policyAcknowledged) return 'You must acknowledge the refund policy.'
  return null
}

export function submitRefundRequest(data: AppData, id: string, input: RefundRequestInput, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadRefund(data, id, actor, 'cargo_facilitator', 'link_sent', 'submit a refund request')
  if ('error' in loaded) return loaded
  const { next, refund, ref } = loaded
  if (!actor.customerId || actor.customerId !== refund.customerId) return fail('You can only request refunds for your own bookings.')
  const bad = validateRefundRequest(input, refund)
  if (bad) return fail(bad)
  const windowMs = next.config.refundWindowDays * 86_400_000
  if (refund.linkSentAt && new Date(now).getTime() - new Date(refund.linkSentAt).getTime() > windowMs) {
    return fail(`The ${next.config.refundWindowDays}-day refund request window has passed.`)
  }
  refund.request = {
    bankName: input.bankName.trim(), accountName: input.accountName.trim(), accountMask: `••••${input.accountNumber.trim().slice(-4)}`,
    confirmedAmount: input.confirmedAmount, policyAcknowledged: true, requestedAt: now,
  }
  record(next, refund, ref, actor, 'Refund request submitted (simulated bank details, policy acknowledged)', 'requested', 'link_sent', now)
  return { ok: true, data: next }
}

const SA_STEPS = {
  review: { from: 'requested', to: 'under_review', action: 'Refund verification started (Super Admin)' },
  approve: { from: 'under_review', to: 'approved', action: 'Refund verified and approved (Super Admin)' },
  process: { from: 'approved', to: 'processed', action: 'Refund processed (simulated Paystack — no money moved)' },
} as const

/** Super Admin advances the refund one step: review → approve → process. Steps cannot be skipped. */
export function advanceRefund(data: AppData, id: string, step: keyof typeof SA_STEPS, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const def = SA_STEPS[step]
  const loaded = loadRefund(data, id, actor, 'super_admin', def.from, `${step} this refund`)
  if ('error' in loaded) return loaded
  const { next, refund, ref } = loaded
  let remarks: string | undefined
  if (step === 'process') {
    refund.processedAt = now
    refund.reference = `DEMO-RFND-${refund.id.slice(-4)}`
    remarks = `Ref ${refund.reference} · ${formatKobo(refund.amount)} to ${refund.request?.accountName ?? 'customer'} ${refund.request?.accountMask ?? ''} (customer notified, simulated)`
  }
  record(next, refund, ref, actor, def.action, def.to, def.from, now, remarks)
  return { ok: true, data: next }
}
