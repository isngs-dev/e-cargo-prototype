import type { AppData } from '@/types/domain'
import type { Booking, Persona, RegistrationApplication } from '@/types/domain'

/** Time of an ISO timestamp; strings with different offsets (+01:00 vs Z) must never be compared as text. */
export const ts = (iso: string | undefined): number => (iso ? Date.parse(iso) || 0 : 0)

/** Newest first, by a timestamp. Use for every list a user reads. */
export function newestFirst<T>(list: readonly T[], at: (x: T) => string | undefined): T[] {
  return [...list].sort((a, b) => ts(at(b)) - ts(at(a)))
}

export function customerName(data: AppData, id: string): string {
  return data.customers.find((c) => c.id === id)?.companyName ?? 'Unknown customer'
}

export function routeLabel(data: AppData, id: string): string {
  const r = data.routes.find((x) => x.id === id)
  return r ? `${r.origin} → ${r.destination}` : 'Unknown route'
}

/** Amount to show for a booking: frozen approved price if available, otherwise indicative. */
export function bookingAmount(b: Booking) {
  return b.approved ? { amount: b.approved.price.totalPayable, frozen: true } : { amount: b.indicativePrice.totalPayable, frozen: false }
}

export function containerSummary(b: Booking): string {
  return b.containers.map((c) => `${c.quantity} × ${c.containerType}`).join(', ')
}

/** Bookings visible to the persona (facilitators see only their own company). */
export function visibleBookings(data: AppData, persona: Persona): Booking[] {
  const list =
    persona.role === 'cargo_facilitator'
      ? data.bookings.filter((b) => b.customerId === persona.customerId)
      : persona.role === 'head_port_operations'
        ? data.bookings.filter((b) => !!b.approved)
        : data.bookings.filter((b) => b.status !== 'draft')
  return newestFirst(list, (b) => b.createdAt)
}

/** Registrations visible to the persona: District Supervisors see only their own district; Director / Super Admin see all. */
export function visibleApplications(data: AppData, persona: Persona): RegistrationApplication[] {
  const list = persona.role === 'district_supervisor' ? data.applications.filter((a) => a.district === persona.district) : data.applications
  return newestFirst(list, (a) => a.submittedAt)
}
