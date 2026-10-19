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
    appendAudit(next, {
      at: now, actorName: actor.name, actorRole: actor.role, entityType: 'refund', entityId: refundId, entityRef: `Refund · ${b.reference}`,
      action: 'Refund created after failed physical verification; awaiting Director', toStatus: 'awaiting_director', remarks: reason.trim(),
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

/**
 * Amend an AWB (baseline §4.6): the number is never edited or reused. An amendment issues a NEW VERSION of the same AWB
 * and marks the previous version superseded (it stays on record). Only before the booking is completed.
 */
export function amendAwb(data: AppData, id: string, input: DispatchInput, reason: string, actor: Actor, now = new Date().toISOString(), today = todayISO()): WorkflowResult<{ version: number }> {
  if (!reason.trim()) return fail('A reason for the amendment is required.')
  const loaded = loadForPort(data, id, actor, 'amend an AWB')
  if ('error' in loaded) return loaded
  const { next, booking: b } = loaded
  if (!b.awb || !b.dispatch) return fail('This booking has no AWB to amend.')
  if (b.status !== 'awb_generated') return fail('Only AWBs on bookings that are not yet completed can be amended.')
  const errors = validateDispatch(input, { counts: true, cargoAndWeight: true, condition: true, hazardous: true }, false, today)
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!)
  const changed = (['wagonNumber', 'trainNumber', 'departureDate', 'departureTime', 'loadingYard'] as const).filter((k) => (input[k].trim() || undefined) !== (b.dispatch![k] ?? undefined))
  if (changed.length === 0) return fail('No change to amend.')

  const previous = b.awb
  b.awbHistory = [...(b.awbHistory ?? []), { ...previous, supersededAt: now }]
  const version = previous.version + 1
  b.awb = { number: previous.number, version, generatedAt: now, verificationRef: demoVerificationRef(previous.number, version), amendmentReason: reason.trim() }
  b.dispatch = {
    wagonNumber: input.wagonNumber.trim(), trainNumber: input.trainNumber.trim(), departureDate: input.departureDate, departureTime: input.departureTime,
    loadingYard: input.loadingYard.trim() || undefined, remarks: input.remarks.trim() || undefined,
  }
  b.updatedAt = now
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: `AWB ${previous.number} amended — version ${version} issued, version ${previous.version} superseded (distribution emails simulated)`,
    remarks: reason.trim(), change: { field: 'AWB dispatch details', from: `v${previous.version}`, to: `v${version} (${changed.join(', ')})` },
  })
  return { ok: true, data: next, version }
}

// ---------------------------------------------------------------- container photos

export const MAX_PHOTOS = 16
const MAX_PHOTO_CHARS = 450_000
const PHOTO_STAGES = ['pending_dispatch', 'credit_approved', 'awb_generated']

export interface PhotoInput { fileName: string; dataUrl: string; caption: string }

/**
 * Head of Port confirms a set of NEW photos in one go. Saved photos are a permanent, view-only record: nothing is ever deleted,
 * a later correction is a re-upload that adds to the earlier photos. Nothing is saved until this is called, and the booking's
 * timeline gets a single entry per confirmation. Simulated storage; small images only.
 */
export function saveContainerPhotos(data: AppData, id: string, change: { add: PhotoInput[] }, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadForPort(data, id, actor, 'confirm container photos')
  if ('error' in loaded) return loaded
  const { next, booking: b } = loaded
  if (!PHOTO_STAGES.includes(b.status)) return fail('Photos can be uploaded while the booking is awaiting dispatch or after the AWB is issued, until it is completed.')
  if (change.add.length === 0) return fail('Add at least one photo before confirming.')
  for (const p of change.add) {
    if (!p.dataUrl.startsWith('data:image/')) return fail('Choose image files only.')
    if (p.dataUrl.length > MAX_PHOTO_CHARS) return fail('An image is too large for the demo. Choose a smaller picture.')
  }
  const existing = b.photos ?? []
  if (existing.length + change.add.length > MAX_PHOTOS) return fail(`A booking can hold up to ${MAX_PHOTOS} photos.`)
  const batch = existing.reduce((m, p) => Math.max(m, p.batch ?? 1), 0) + 1
  const stamp = Date.parse(now)
  const added = change.add.map((p, i) => ({
    id: `ph-${b.id}-${stamp}-${i + 1}`, fileName: p.fileName.trim() || 'container-photo', dataUrl: p.dataUrl, caption: p.caption.trim() || 'Container photo', addedAt: now, addedBy: actor.name, batch,
  }))
  b.photos = [...existing, ...added]
  b.updatedAt = now
  const n = added.length
  const noun = `${n} photo${n === 1 ? '' : 's'}`
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'booking', entityId: b.id, entityRef: b.reference,
    action: existing.length === 0
      ? `Container photos uploaded (${noun}; ${b.photos.length} on file)`
      : `Container photos re-uploaded (${n} new; ${existing.length} earlier kept; ${b.photos.length} on file)`,
  })
  return { ok: true, data: next }
}
