import type { AppData } from '@/types/domain'
import type { Booking, Persona } from '@/types/domain'

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
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
