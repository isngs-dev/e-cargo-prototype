import type { AppData, Booking, ISODate } from '@/types/domain'
import { demoVerificationRef, formatAwbNumber } from '@/lib/awb'
import { formatKobo } from '@/lib/money'
import { isReadyForDispatch } from '@/lib/status'
import { appendAudit } from './audit'
import { todayISO } from './booking'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Port operations (baseline §4.5, §4.6). Head of Port physically verifies, records dispatch details and
 * approves dispatch, which generates the AWB. Generation is idempotent: repeating it returns the existing AWB.
 * A booking only reaches this stage when its payment (Pay Now) or credit (Pay After Credit) condition is met.
 */

export interface DispatchInput {
  wagonNumber: string
  trainNumber: string
  departureDate: ISODate
  departureTime: string
  loadingYard: string
  remarks: string
}

export interface PhysicalChecks {
  /** Container / wagon count matches the declaration. */
  counts: boolean
  /** Cargo type and weight match the declaration. */
  cargoAndWeight: boolean
  /** Condition and suitability for dispatch. */
  condition: boolean
  /** Hazardous handling compliance — only required for hazardous cargo. */
  hazardous: boolean
}

export const emptyDispatch = (): DispatchInput => ({ wagonNumber: '', trainNumber: '', departureDate: '', departureTime: '', loadingYard: '', remarks: '' })
export const emptyChecks = (): PhysicalChecks => ({ counts: false, cargoAndWeight: false, condition: false, hazardous: false })

export type DispatchErrors = Partial<Record<keyof DispatchInput | 'checks', string>>

export function validateDispatch(input: DispatchInput, checks: PhysicalChecks, hazardous: boolean, today = todayISO()): DispatchErrors {
  const e: DispatchErrors = {}
  if (!input.wagonNumber.trim()) e.wagonNumber = 'Enter the wagon number.'
  if (!input.trainNumber.trim()) e.trainNumber = 'Enter the train number.'
  if (!input.departureDate) e.departureDate = 'Select the departure date.'
  else if (input.departureDate < today) e.departureDate = 'Departure date cannot be in the past.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.departureTime)) e.departureTime = 'Enter the departure time (HH:MM).'
  if (!checks.counts || !checks.cargoAndWeight || !checks.condition || (hazardous && !checks.hazardous)) {
    e.checks = 'Confirm every physical verification item before approving dispatch.'
  }
  return e
}

function loadForPort(data: AppData, id: string, actor: Actor, verb: string) {
  if (actor.role !== 'head_port_operations') return fail(`Only the Head of Port Operations can ${verb}.`)
  const next = structuredClone(data)
  const booking = next.bookings.find((b) => b.id === id)
  if (!booking) return fail('Booking not found.')
  return { next, booking }
}

/**
 * Approve dispatch and generate the AWB. Repeating the action for a booking that already has an AWB
 * returns that AWB unchanged (no second number, no extra audit entry).
 */
export function approveDispatch(
  data: AppData, id: string, input: DispatchInput, checks: PhysicalChecks, actor: Actor, now = new Date().toISOString(), today = todayISO(),
): WorkflowResult<{ awbNumber: string; existing: boolean }> {
  const loaded = loadForPort(data, id, actor, 'approve dispatch')
  if ('error' in loaded) return loaded
  const { next, booking: b } = loaded

  if (b.awb) return { ok: true, data, awbNumber: b.awb.number, existing: true }
  if (!isReadyForDispatch(b)) {
    return fail(b.status === 'awaiting_payment' ? 'Payment has not cleared. The booking cannot be dispatched until it is paid.' : 'This booking is not ready for dispatch.')
  }
  const errors = validateDispatch(input, checks, b.hazardous, today)
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!)

  const seq = next.counters.nextAwbSeq++
  const number = formatAwbNumber(new Date(now).getFullYear(), seq)
  b.dispatch = {
    wagonNumber: input.wagonNumber.trim(), trainNumber: input.trainNumber.trim(), departureDate: input.departureDate,
    departureTime: input.departureTime, loadingYard: input.loadingYard.trim() || undefined, remarks: input.remarks.trim() || undefined,
  }
  b.awb = { number, version: 1, generatedAt: now, verificationRef: demoVerificationRef(number) }
  const from = b.status
  b.status = 'awb_generated'
  b.updatedAt = now
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: `Physical verification passed; dispatch approved; AWB ${number} generated`, fromStatus: from, toStatus: 'awb_generated',
    remarks: `Train ${b.dispatch.trainNumber}, wagon ${b.dispatch.wagonNumber}, departs ${b.dispatch.departureDate} ${b.dispatch.departureTime}. AWB shared with customer, Head of Cargo, Director and Head of Port (email simulated).`,
  })
  return { ok: true, data: next, awbNumber: number, existing: false }
}

/**
 * Physical verification failed: cancel and report to the Director with a mandatory reason. Capacity is released.
 * If money was received a refund record is created for the Director to review; unpaid credit is cancelled.
 */
export function failPhysicalVerification(data: AppData, id: string, reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult<{ refundId?: string }> {
  if (!reason.trim()) return fail('A reason is required when physical verification fails.')
  const loaded = loadForPort(data, id, actor, 'fail physical verification')
  if ('error' in loaded) return loaded
  const { next, booking: b } = loaded
  if (b.awb) return fail('An AWB has already been generated for this booking.')
  if (!isReadyForDispatch(b)) return fail('Only bookings awaiting dispatch can be physically verified.')

  const paid = b.payment.status === 'paid' || b.payment.status === 'credit_settled'
  const from = b.status
  b.status = 'rejected_physical'
  b.updatedAt = now
  let refundId: string | undefined
  if (paid && b.approved) {
    refundId = `rf-${b.reference.slice(-4)}`
    next.refunds.push({
      id: refundId, bookingId: b.id, customerId: b.customerId, amount: b.approved.price.totalPayable,
      reason: reason.trim(), status: 'awaiting_director', createdAt: now,
    })
  } else {
    b.payment = { ...b.payment, status: 'cancelled' } // unpaid credit no longer counts towards the threshold
  }
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: 'Physical verification failed; reported to Director', fromStatus: from, toStatus: 'rejected_physical',
    remarks: `${reason.trim()} Capacity released. ${paid && b.approved ? `Payment of ${formatKobo(b.approved.price.totalPayable)} received — refund flow started.` : 'No payment received — no refund required.'}`,
  })
  return { ok: true, data: next, refundId }
}

/** Head of Port marks an AWB-generated booking as completed (consignment delivered). */
export function completeBooking(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadForPort(data, id, actor, 'complete this booking')
  if ('error' in loaded) return loaded
  const { next, booking: b } = loaded
  if (b.status !== 'awb_generated') return fail('Only bookings with a generated AWB can be completed.')
  b.status = 'completed'
  b.updatedAt = now
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: 'Consignment delivered; booking completed', fromStatus: 'awb_generated', toStatus: 'completed',
  })
  return { ok: true, data: next }
}

export type { Booking }
