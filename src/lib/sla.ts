import type { AppData, Booking, RegistrationApplication, SlaConfig } from '@/types/domain'
import { isReadyForDispatch } from './status'

/**
 * Approval ageing (open item D-9, targets are PROPOSED). Shows how long an item has waited at its current stage
 * against a configurable target. It is an indicator and escalation flag only — nothing is ever auto-approved.
 */

export type SlaStage = keyof SlaConfig

export function registrationStage(a: RegistrationApplication): SlaStage | null {
  if (a.status === 'pending_district_verification' || a.status === 'sent_back_to_district') return 'registrationDistrictHours'
  if (a.status === 'pending_director_approval') return 'registrationDirectorHours'
  return null
}

export function bookingStage(b: Booking): SlaStage | null {
  if (b.status === 'pending_hoc_review' || b.status === 'sent_back_to_hoc') return 'bookingCargoHours'
  if (b.status === 'pending_director_review') return 'bookingDirectorHours'
  if (isReadyForDispatch(b)) return 'dispatchHours'
  return null
}

/** When the item entered its current status (latest matching audit entry, else its last update). */
export function waitingSince(data: AppData, entityType: 'registration' | 'booking', id: string, status: string, fallback: string): string {
  for (let i = data.audit.length - 1; i >= 0; i--) {
    const e = data.audit[i]!
    if (e.entityType === entityType && e.entityId === id && e.toStatus === status) return e.at
  }
  return fallback
}

export type AgeLevel = 'ok' | 'due' | 'overdue' | 'escalated'

export interface Ageing { hours: number; targetHours: number; level: AgeLevel; label: string }

export function ageing(since: string, now: Date, targetHours: number): Ageing {
  const hours = Math.max(0, (now.getTime() - new Date(since).getTime()) / 3_600_000)
  const level: AgeLevel = hours >= targetHours * 2 ? 'escalated' : hours >= targetHours ? 'overdue' : hours >= targetHours * 0.75 ? 'due' : 'ok'
  const d = Math.floor(hours / 24)
  const h = Math.floor(hours % 24)
  return { hours, targetHours, level, label: d > 0 ? `${d}d ${h}h` : `${Math.floor(hours)}h` }
}

export function registrationAgeing(data: AppData, a: RegistrationApplication, now = new Date()): Ageing | null {
  const stage = registrationStage(a)
  return stage ? ageing(waitingSince(data, 'registration', a.id, a.status, a.updatedAt), now, data.config.sla[stage]) : null
}

export function bookingAgeing(data: AppData, b: Booking, now = new Date()): Ageing | null {
  const stage = bookingStage(b)
  return stage ? ageing(waitingSince(data, 'booking', b.id, b.status, b.updatedAt), now, data.config.sla[stage]) : null
}
