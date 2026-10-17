import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { naira } from '@/lib/money'
import type { AppData, UploadedDocument } from '@/types/domain'
import { bookingBlock, createBooking, emptyBooking, indicativePrice, validateBooking, type BookingInput } from './booking'
import type { Actor } from './result'

const TODAY = '2026-10-13'
const NOW = '2026-10-13T12:00:00+01:00'
const lagoon: Actor = { name: 'Adaeze Okafor', role: 'cargo_facilitator', customerId: 'cus-lagoon' }
const gateway: Actor = { name: 'Ibrahim Musa', role: 'cargo_facilitator', customerId: 'cus-gateway' }

const doc = (kind: UploadedDocument['kind']): UploadedDocument => ({ id: kind, kind, fileName: `${kind}.pdf`, sizeKb: 50, uploadedAt: NOW })
const input = (patch: Partial<BookingInput> = {}): BookingInput => ({
  ...emptyBooking(), bookingDate: '2026-10-20', routeId: 'rt-ebm', containers: [{ containerType: '20ft', quantity: 2 }], weightTons: 38,
  commodity: 'Packaged beverages', documents: [doc('bill_of_lading'), doc('packing_list'), doc('invoice')], declaration: true, ...patch,
})
const customer = (d: AppData, id: string) => d.customers.find((c) => c.id === id)!

describe('booking validation', () => {
  it('accepts a complete booking', () => expect(validateBooking(input(), TODAY)).toEqual({}))

  it('requires the mandatory fields, documents and declaration', () => {
    const e = validateBooking({ ...emptyBooking(), documents: [] }, TODAY)
    expect(Object.keys(e).sort()).toEqual(['bookingDate', 'commodity', 'containers', 'declaration', 'documents', 'routeId', 'weightTons'])
  })
  it('starts with no container type chosen (quantity 1), and asks for one', () => {
    const b = emptyBooking()
    expect(b.containers).toEqual([{ containerType: '', quantity: 1 }])
    expect(validateBooking({ ...b, bookingDate: '2026-11-12', routeId: 'rt-ebm', weightTons: 10, commodity: 'x' }, TODAY).containers).toMatch(/Select the container type/)
    expect(validateBooking(input({ containers: [{ containerType: '20ft', quantity: 1 }] }), TODAY).containers).toBeUndefined()
  })
  it('blocks past dates', () => expect(validateBooking(input({ bookingDate: '2026-10-12' }), TODAY).bookingDate).toBeDefined())
  it('requires a compliance document for hazardous cargo', () => {
    expect(validateBooking(input({ hazardous: true }), TODAY).documents).toMatch(/Hazardous/)
    expect(validateBooking(input({ hazardous: true, documents: [...input().documents, doc('hazardous_compliance')] }), TODAY)).toEqual({})
  })
  it('validates container lines', () => {
    expect(validateBooking(input({ containers: [] }), TODAY).containers).toBeDefined()
    expect(validateBooking(input({ containers: [{ containerType: '20ft', quantity: 0 }] }), TODAY).containers).toBeDefined()
    expect(validateBooking(input({ containers: [{ containerType: '20ft', quantity: 1 }, { containerType: '20ft', quantity: 1 }] }), TODAY).containers).toMatch(/only once/)
    expect(validateBooking(input({ containers: [{ containerType: 'Wagon', quantity: 1 }] }), TODAY).containers).toBeDefined() // wagon on containerized
    expect(validateBooking(input({ cargoType: 'Non-Containerized', containers: [{ containerType: 'Wagon', quantity: 3 }] }), TODAY).containers).toBeUndefined()
  })
})

describe('indicative pricing', () => {
  it('matches the confirmed Priority example including the discount', () => {
    const d = createSeedData()
    const r = indicativePrice(d, customer(d, 'cus-lagoon'), input())
    expect(r.ok && r.price.totalPayable).toBe(naira(177_795))
    expect(r.ok && r.price.discount).toBe(naira(18_000))
  })
  it('gives Non-Priority customers no discount', () => {
    const d = createSeedData()
    const r = indicativePrice(d, customer(d, 'cus-gateway'), input())
    expect(r.ok && r.price.discount).toBe(0)
    expect(r.ok && r.price.totalPayable).toBe(naira(197_550))
  })
  it('never prices a route/cargo type with no rate (Moniya non-containerized)', () => {
    const d = createSeedData()
    const r = indicativePrice(d, customer(d, 'cus-gateway'), input({ routeId: 'rt-mny', cargoType: 'Non-Containerized', containers: [{ containerType: 'Wagon', quantity: 2 }] }))
    expect(r.ok).toBe(false)
  })
})

describe('createBooking', () => {
  it('creates a Pending Head of Cargo Review booking, takes no payment, and audits it', () => {
    const d = createSeedData()
    const r = createBooking(d, input(), lagoon, NOW, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const b = r.data.bookings.find((x) => x.id === r.bookingId)!
    expect(b).toMatchObject({ status: 'pending_hoc_review', reference: 'NRC-BK-2026-0421', customerId: 'cus-lagoon', payment: { status: 'not_due' } })
    expect(b.approved).toBeUndefined()
    expect(b.indicativePrice.totalPayable).toBe(naira(177_795))
    expect(r.data.audit.at(-1)).toMatchObject({ entityId: b.id, toStatus: 'pending_hoc_review', actorRole: 'cargo_facilitator' })
    expect(d.bookings.some((x) => x.id === b.id)).toBe(false) // input data untouched
  })
  it('is only available to activated facilitators, for their own company', () => {
    const d = createSeedData()
    expect(createBooking(d, input(), { name: 'x', role: 'director_operations' }, NOW, TODAY).ok).toBe(false)
    expect(createBooking(d, input(), { name: 'x', role: 'cargo_facilitator' }, NOW, TODAY).ok).toBe(false)
    const r = createBooking(d, input(), gateway, NOW, TODAY)
    expect(r.ok && r.data.bookings.at(-1)!.customerId).toBe('cus-gateway')
  })
  it('blocks submission when no freight rate exists', () => {
    const d = createSeedData()
    const r = createBooking(d, input({ routeId: 'rt-mny', cargoType: 'Non-Containerized', containers: [{ containerType: 'Wagon', quantity: 2 }] }), gateway, NOW, TODAY)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/No freight rate/)
  })
  it('blocks suspended and blacklisted customers', () => {
    const d = createSeedData()
    expect(bookingBlock(d, customer(d, 'cus-ikorodu'))).toMatch(/suspended/)
    expect(bookingBlock(d, customer(d, 'cus-deltaswift'))).toMatch(/blacklisted/)
    expect(createBooking(d, input(), { ...lagoon, customerId: 'cus-ikorodu' }, NOW, TODAY).ok).toBe(false)
  })
  it('blocks bookings once outstanding credit exceeds the threshold', () => {
    const d = createSeedData()
    d.customers.find((c) => c.id === 'cus-lagoon')!.eligibility.creditThreshold = naira(100_000) // outstanding seed credit is above this
    expect(bookingBlock(d, customer(d, 'cus-lagoon'))).toMatch(/Credit threshold exceeded/)
    expect(createBooking(d, input(), lagoon, NOW, TODAY).ok).toBe(false)
  })
  it('drops a stray hazardous document when cargo is not hazardous', () => {
    const d = createSeedData()
    const r = createBooking(d, input({ documents: [...input().documents, doc('hazardous_compliance')] }), lagoon, NOW, TODAY)
    expect(r.ok && r.data.bookings.at(-1)!.documents.some((x) => x.kind === 'hazardous_compliance')).toBe(false)
  })
  it('rejects invalid input without changing data', () => {
    const d = createSeedData()
    const before = d.bookings.length
    expect(createBooking(d, input({ declaration: false }), lagoon, NOW, TODAY).ok).toBe(false)
    expect(d.bookings.length).toBe(before)
  })
})
