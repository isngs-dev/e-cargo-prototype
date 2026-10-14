import type { AppData, Booking, ContainerLine, ContainerType, ISODate } from '@/types/domain'

/**
 * Simulated train / route capacity (baseline original scope, open item D-6 — NRC has not confirmed the rule).
 * A route has a daily capacity in "capacity units" (20ft = 1, 40ft = 2, Reefer = 2, Wagon = 1 — demo assumption).
 * Bookings that are still live consume capacity on their booking date; rejected / cancelled bookings release it.
 * A route with no capacity rule is treated as unconstrained.
 */

export const UNITS: Record<ContainerType, number> = { '20ft': 1, '40ft': 2, Reefer: 2, Wagon: 1 }

export const unitsFor = (containers: ContainerLine[]) =>
  containers.reduce((sum, c) => sum + UNITS[c.containerType] * (Number.isFinite(c.quantity) ? c.quantity : 0), 0)

const RELEASED: Booking['status'][] = ['draft', 'rejected_hoc', 'rejected_director', 'rejected_physical', 'auto_cancelled']
export const consumesCapacity = (b: Booking) => !RELEASED.includes(b.status)

export interface Availability {
  /** null = no capacity rule configured (unconstrained). */
  capacity: number | null
  used: number
  remaining: number
  blockedReason?: string
}

export function availability(data: AppData, routeId: string, date: ISODate, excludeBookingId?: string): Availability {
  const rule = data.capacity.find((c) => c.routeId === routeId)
  const block = data.maintenanceBlocks.find((m) => m.routeId === routeId && m.date === date)
  const used = data.bookings
    .filter((b) => b.routeId === routeId && b.bookingDate === date && b.id !== excludeBookingId && consumesCapacity(b))
    .reduce((sum, b) => sum + unitsFor(b.containers), 0)
  if (block) return { capacity: rule?.dailyUnits ?? null, used, remaining: 0, blockedReason: `No slots — ${block.reason}` }
  if (!rule) return { capacity: null, used, remaining: Number.POSITIVE_INFINITY }
  return { capacity: rule.dailyUnits, used, remaining: Math.max(0, rule.dailyUnits - used) }
}

export type CapacityCheck = { ok: true; remaining: number } | { ok: false; reason: string; remaining: number }

export function checkCapacity(data: AppData, routeId: string, date: ISODate, containers: ContainerLine[], excludeBookingId?: string): CapacityCheck {
  const a = availability(data, routeId, date, excludeBookingId)
  if (a.blockedReason) return { ok: false, reason: `${a.blockedReason}. Choose another date or join the waitlist.`, remaining: 0 }
  const need = unitsFor(containers)
  if (need > a.remaining) {
    return {
      ok: false, remaining: a.remaining,
      reason: a.remaining === 0
        ? 'No slots available on this date. Choose another date or join the waitlist.'
        : `Only ${a.remaining} capacity unit${a.remaining === 1 ? '' : 's'} left on this date; this booking needs ${need}. Reduce the quantity, choose another date, or join the waitlist.`,
    }
  }
  return { ok: true, remaining: a.remaining }
}

export type LoadLevel = 'open' | 'limited' | 'full' | 'maintenance'

export function loadLevel(a: Availability): LoadLevel {
  if (a.blockedReason) return 'maintenance'
  if (a.capacity === null) return 'open'
  if (a.remaining === 0) return 'full'
  return a.remaining / a.capacity <= 0.25 ? 'limited' : 'open'
}
