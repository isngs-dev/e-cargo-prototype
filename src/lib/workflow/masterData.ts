import type { AppData, CargoType, ContainerType, ISODate, PlatformConfig, Route } from '@/types/domain'
import { findRate } from '@/lib/pricing'
import { formatBp, formatKobo, naira } from '@/lib/money'
import { appendAudit } from './audit'
import { todayISO } from './booking'
import { containerTypesFor } from './booking'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Master data & platform configuration (baseline §2.2) — Super Admin only; the Director has view access.
 * Freight rates are effective-dated: a change INSERTS a new row and never edits or deletes an existing one.
 * Changes never touch bookings that already carry a frozen price.
 */

const gate = (actor: Actor) => (actor.role === 'super_admin' ? null : fail('Only Super Admin can change master data.'))

function log(next: AppData, actor: Actor, id: string, ref: string, action: string, now: string, change?: { field: string; from: string; to: string }, remarks?: string) {
  appendAudit(next, { at: now, actorName: actor.name, actorRole: actor.role, entityType: 'master_data', entityId: id, entityRef: ref, action, change, remarks })
}

export interface RateInput {
  routeId: string
  cargoType: CargoType
  containerType: ContainerType
  /** Rate per unit in naira. */
  rateNaira: number
  effectiveFrom: ISODate
}

export function insertFreightRate(data: AppData, input: RateInput, actor: Actor, now = new Date().toISOString(), today = todayISO()): WorkflowResult<{ rateId: string }> {
  const denied = gate(actor)
  if (denied) return denied
  const route = data.routes.find((r) => r.id === input.routeId)
  if (!route) return fail('Select a route.')
  if (!containerTypesFor(input.cargoType).includes(input.containerType)) return fail(`${input.cargoType} cargo is priced by ${containerTypesFor(input.cargoType).join(' / ')}.`)
  if (!Number.isFinite(input.rateNaira) || input.rateNaira <= 0) return fail('The rate must be above zero.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return fail('Select the effective date.')
  if (input.effectiveFrom < today) return fail('The effective date cannot be in the past — rates are inserted, never back-dated.')
  const clash = data.freightRates.some((r) => r.routeId === input.routeId && r.cargoType === input.cargoType && r.containerType === input.containerType && r.effectiveFrom === input.effectiveFrom)
  if (clash) return fail('A rate for this route, cargo type and container type already starts on that date. Choose a later date.')

  const next = structuredClone(data)
  const previous = findRate(data.freightRates, input.routeId, input.cargoType, input.containerType, input.effectiveFrom)
  const rate = {
    id: `fr-${route.code.toLowerCase()}-${input.containerType.toLowerCase()}-${input.effectiveFrom}`, routeId: input.routeId, cargoType: input.cargoType,
    containerType: input.containerType, ratePerUnit: naira(input.rateNaira), effectiveFrom: input.effectiveFrom,
  }
  next.freightRates.push(rate)
  log(next, actor, rate.id, `${route.code} · ${input.cargoType} · ${input.containerType}`, `Freight rate row inserted (effective ${input.effectiveFrom}); earlier rows retained`, now,
    { field: `${route.code} / ${input.cargoType} / ${input.containerType}`, from: previous ? formatKobo(previous.ratePerUnit) : 'no rate', to: formatKobo(rate.ratePerUnit) })
  return { ok: true, data: next, rateId: rate.id }
}

export interface RouteInput { code: string; origin: string; destination: string; distanceKm: number }

export function addRoute(data: AppData, input: RouteInput, actor: Actor, now = new Date().toISOString()): WorkflowResult<{ routeId: string }> {
  const denied = gate(actor)
  if (denied) return denied
  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,12}$/.test(code)) return fail('Route code must be 3–12 letters, digits or hyphens.')
  if (data.routes.some((r) => r.code === code)) return fail('A route with this code already exists.')
  if (input.origin.trim().length < 2 || input.destination.trim().length < 2) return fail('Enter the origin and destination.')
  if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) return fail('Enter the distance in km.')
  const next = structuredClone(data)
  const route: Route = { id: `rt-${code.toLowerCase()}`, code, origin: input.origin.trim(), destination: input.destination.trim(), distanceKm: input.distanceKm, active: true }
  next.routes.push(route)
  log(next, actor, route.id, code, `Route added: ${route.origin} → ${route.destination}. No rates exist yet, so bookings stay blocked until rates are inserted`, now)
  return { ok: true, data: next, routeId: route.id }
}

/** Routes are deactivated, never deleted. Existing bookings keep their route. */
export function setRouteActive(data: AppData, routeId: string, active: boolean, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const denied = gate(actor)
  if (denied) return denied
  const next = structuredClone(data)
  const route = next.routes.find((r) => r.id === routeId)
  if (!route) return fail('Route not found.')
  if (route.active === active) return fail(`The route is already ${active ? 'active' : 'inactive'}.`)
  route.active = active
  log(next, actor, route.id, route.code, active ? 'Route activated' : 'Route deactivated (hidden from new bookings; existing bookings unchanged)', now, { field: 'Active', from: String(!active), to: String(active) })
  return { ok: true, data: next }
}

const bp = (n: number) => Number.isInteger(n) && n >= 0 && n <= 5000
const fmtConfig = (k: keyof PlatformConfig, c: PlatformConfig): string => {
  switch (k) {
    case 'tax': return `VAT ${formatBp(c.tax.vatBp)} · Stamp ${formatBp(c.tax.stampDutyBp)} · Insurance ${formatBp(c.tax.insuranceBp)} · on ${c.tax.basis} freight`
    case 'paymentWindowHours': return `${c.paymentWindowHours} hours`
    case 'paymentReminderHours': return `${c.paymentReminderHours} hours`
    case 'refundWindowDays': return `${c.refundWindowDays} days`
    case 'taxCertificateRequired': return c.taxCertificateRequired ? 'required' : 'optional'
  }
}

export function validateConfig(c: PlatformConfig): string | null {
  if (![c.tax.vatBp, c.tax.stampDutyBp, c.tax.insuranceBp].every(bp)) return 'Tax and levy rates must be between 0% and 50%.'
  if (c.tax.basis !== 'net' && c.tax.basis !== 'gross') return 'Select the tax basis.'
  if (!Number.isInteger(c.paymentWindowHours) || c.paymentWindowHours < 1 || c.paymentWindowHours > 720) return 'The payment window must be 1–720 hours.'
  if (!Number.isInteger(c.paymentReminderHours) || c.paymentReminderHours < 1 || c.paymentReminderHours >= c.paymentWindowHours) return 'The reminder must be at least 1 hour and earlier than the payment window.'
  if (!Number.isInteger(c.refundWindowDays) || c.refundWindowDays < 1 || c.refundWindowDays > 365) return 'The refund window must be 1–365 days.'
  return null
}

/** Update platform configuration. One audit entry per changed setting (old → new). Frozen booking prices are unaffected. */
export function updateConfig(data: AppData, config: PlatformConfig, actor: Actor, now = new Date().toISOString(), reason = ''): WorkflowResult<{ changed: number }> {
  const denied = gate(actor)
  if (denied) return denied
  const bad = validateConfig(config)
  if (bad) return fail(bad)
  const keys: (keyof PlatformConfig)[] = ['tax', 'paymentWindowHours', 'paymentReminderHours', 'refundWindowDays', 'taxCertificateRequired']
  const changed = keys.filter((k) => JSON.stringify(data.config[k]) !== JSON.stringify(config[k]))
  if (changed.length === 0) return fail('No changes to save.')
  const next = structuredClone(data)
  for (const k of changed) {
    log(next, actor, `config-${k}`, 'Platform configuration', `Configuration changed: ${k}`, now, { field: k, from: fmtConfig(k, data.config), to: fmtConfig(k, config) }, reason.trim() || undefined)
  }
  next.config = structuredClone(config)
  return { ok: true, data: next, changed: changed.length }
}
