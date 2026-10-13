import type {
  AppData,
  Booking,
  CargoType,
  ContainerLine,
  ContainerType,
  Customer,
  DocumentKind,
  ISODate,
  PriceBreakdown,
  UploadedDocument,
} from '@/types/domain'
import { indicativeDiscountBp, isCreditBlocked, outstandingCredit } from '@/lib/eligibility'
import { formatKobo } from '@/lib/money'
import { tryCalculatePrice } from '@/lib/pricing'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Booking creation (baseline §4.1). Submitting takes NO payment; the booking goes to Head of Cargo review.
 * Not modelled yet: drafts, capacity / train-slot validation (open item D-6).
 */

export interface BookingInput {
  bookingDate: ISODate
  cargoType: CargoType
  routeId: string
  containers: ContainerLine[]
  weightTons: number
  commodity: string
  hazardous: boolean
  specialHandling: string
  remarks: string
  documents: UploadedDocument[]
  declaration: boolean
}

export const containerTypesFor = (cargo: CargoType): ContainerType[] =>
  cargo === 'Containerized' ? ['20ft', '40ft', 'Reefer'] : ['Wagon']

/** Bill of Lading, Packing List, Invoice mandatory; Radiation / Customs optional uploads (open item D-7). */
export const MANDATORY_BOOKING_DOCS: DocumentKind[] = ['bill_of_lading', 'packing_list', 'invoice']
export const OPTIONAL_BOOKING_DOCS: DocumentKind[] = ['radiation_certificate', 'customs_clearance']

export const requiredBookingDocs = (hazardous: boolean): DocumentKind[] =>
  hazardous ? [...MANDATORY_BOOKING_DOCS, 'hazardous_compliance'] : MANDATORY_BOOKING_DOCS

export const emptyBooking = (): BookingInput => ({
  bookingDate: '', cargoType: 'Containerized', routeId: '', containers: [{ containerType: '20ft', quantity: 1 }],
  weightTons: NaN, commodity: '', hazardous: false, specialHandling: '', remarks: '', documents: [], declaration: false,
})

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type BookingErrors = Partial<Record<'bookingDate' | 'routeId' | 'containers' | 'weightTons' | 'commodity' | 'documents' | 'declaration', string>>

export function validateBooking(v: BookingInput, today = todayISO()): BookingErrors {
  const e: BookingErrors = {}
  if (!v.bookingDate) e.bookingDate = 'Select a booking date.'
  else if (v.bookingDate < today) e.bookingDate = 'Booking date cannot be in the past.'
  if (!v.routeId) e.routeId = 'Select a route.'
  const allowed = containerTypesFor(v.cargoType)
  if (v.containers.length === 0) e.containers = 'Add at least one container or wagon line.'
  else if (v.containers.some((c) => !allowed.includes(c.containerType))) e.containers = `${v.cargoType} bookings accept ${allowed.join(' / ')} only.`
  else if (v.containers.some((c) => !Number.isInteger(c.quantity) || c.quantity <= 0)) e.containers = 'Quantities must be whole numbers above zero.'
  else if (new Set(v.containers.map((c) => c.containerType)).size !== v.containers.length) e.containers = 'Each container type can appear only once — combine the quantities.'
  if (!Number.isFinite(v.weightTons) || v.weightTons <= 0) e.weightTons = 'Enter the total weight in tons.'
  if (v.commodity.trim().length < 2) e.commodity = 'Enter the commodity type.'
  const missing = requiredBookingDocs(v.hazardous).filter((k) => !v.documents.some((d) => d.kind === k))
  if (missing.length) e.documents = `Upload: ${missing.map(docName).join(', ')}.`
  if (!v.declaration) e.declaration = 'You must confirm compliance with the NRC Fair Cargo Policy.'
  return e
}

const docName = (k: DocumentKind) =>
  ({ bill_of_lading: 'Bill of Lading', packing_list: 'Packing List', invoice: 'Invoice', hazardous_compliance: 'Hazardous compliance document' } as Partial<Record<DocumentKind, string>>)[k] ?? k

/** Account-level reasons a customer cannot create a booking at all. */
export function bookingBlock(data: AppData, customer: Customer): string | null {
  if (customer.accountStatus === 'suspended') return 'Your account is suspended. Contact NRC Cargo Operations.'
  if (customer.accountStatus === 'blacklisted') return 'Your account is blacklisted. Bookings cannot be created.'
  const outstanding = outstandingCredit(data.bookings, customer.id)
  if (isCreditBlocked(customer.eligibility, outstanding)) {
    return `Credit threshold exceeded (${formatKobo(outstanding)} outstanding of ${formatKobo(customer.eligibility.creditThreshold)}). Further bookings are blocked until the balance is settled.`
  }
  return null
}

/** Indicative price using the customer's eligible discount (priority only). */
export function indicativePrice(data: AppData, customer: Customer, v: Pick<BookingInput, 'routeId' | 'cargoType' | 'containers' | 'bookingDate'>):
  { ok: true; price: PriceBreakdown } | { ok: false; error: string } {
  if (!v.routeId) return { ok: false, error: 'Select a route to see the price.' }
  const bookingDate = v.bookingDate || todayISO()
  return tryCalculatePrice({ ...v, bookingDate, discountBp: indicativeDiscountBp(customer.eligibility) }, data.freightRates, data.config.tax)
}

export function createBooking(
  data: AppData, input: BookingInput, actor: Actor, now = new Date().toISOString(), today = todayISO(),
): WorkflowResult<{ bookingId: string }> {
  if (actor.role !== 'cargo_facilitator' || !actor.customerId) return fail('Only an activated cargo facilitator can create bookings.')
  const customer = data.customers.find((c) => c.id === actor.customerId)
  if (!customer) return fail('Customer account not found.')
  const blocked = bookingBlock(data, customer)
  if (blocked) return fail(blocked)
  const route = data.routes.find((r) => r.id === input.routeId)
  if (!route || !route.active) return fail('Selected route is not available.')
  const errors = validateBooking(input, today)
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!)
  const priced = indicativePrice(data, customer, input)
  if (!priced.ok) return fail(priced.error)

  const next = structuredClone(data)
  const seq = next.counters.nextBookingSeq++
  const booking: Booking = {
    id: `bk-${seq}`, reference: `NRC-BK-2026-${String(seq).padStart(4, '0')}`, customerId: customer.id,
    bookingDate: input.bookingDate, cargoType: input.cargoType, routeId: input.routeId, containers: input.containers,
    weightTons: input.weightTons, commodity: input.commodity.trim(), hazardous: input.hazardous,
    specialHandling: input.specialHandling.trim() || undefined, remarks: input.remarks.trim() || undefined,
    // hazardous compliance document is only kept when the cargo is flagged hazardous
    documents: input.documents.filter((d) => input.hazardous || d.kind !== 'hazardous_compliance'),
    status: 'pending_hoc_review', indicativePrice: priced.price, payment: { status: 'not_due' },
    createdAt: now, updatedAt: now, isDemo: true,
  }
  next.bookings.push(booking)
  next.audit.push({
    id: `au-${String(next.audit.length + 1).padStart(4, '0')}`, at: now, actorName: actor.name, actorRole: actor.role,
    entityType: 'booking', entityId: booking.id, entityRef: booking.reference, action: 'Booking submitted with compliance declaration',
    toStatus: booking.status, remarks: `Indicative total ${formatKobo(priced.price.totalPayable)} accepted by facilitator. No payment taken.`,
  })
  return { ok: true, data: next, bookingId: booking.id }
}
