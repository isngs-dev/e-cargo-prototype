import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { availability, checkCapacity, loadLevel, unitsFor } from '@/lib/capacity'
import { verifyAwb } from '@/lib/awb'
import { ageing, bookingAgeing, bookingStage, registrationAgeing, registrationStage, waitingSince } from '@/lib/sla'
import type { AppData, Booking } from '@/types/domain'
import { createBooking, emptyBooking, joinWaitlist, leaveWaitlist, type BookingInput } from './booking'
import { amendAwb, approveDispatch, completeBooking, type DispatchInput } from './dispatch'
import { addMaintenanceBlock, removeMaintenanceBlock, setRouteCapacity, updateConfig, validateConfig } from './masterData'
import { advanceRefund, reverseRefund, submitRefundRequest, triggerRefund } from './refund'
import type { Actor, WorkflowResult } from './result'
import { directorRejectBooking } from './bookingApproval'

const NOW = '2026-10-14T10:00:00+01:00'
const TODAY = '2026-10-14'
const sa: Actor = { name: 'Tunde Bakare', role: 'super_admin' }
const dir: Actor = { name: 'Aliyu Bello', role: 'director_operations' }
const hop: Actor = { name: 'Grace Etim', role: 'head_port_operations' }
const lagoon: Actor = { name: 'Adaeze Okafor', role: 'cargo_facilitator', customerId: 'cus-lagoon' }
const northbound: Actor = { name: 'Bola Ajayi', role: 'cargo_facilitator', customerId: 'cus-northbound' }

function ok<T extends object>(r: WorkflowResult<T>): Extract<WorkflowResult<T>, { ok: true }> {
  if (!r.ok) throw new Error(r.error)
  return r
}
const get = (d: AppData, id: string): Booking => d.bookings.find((b) => b.id === id)!

const docs = (['bill_of_lading', 'packing_list', 'invoice'] as const).map((k) => ({ id: k, kind: k, fileName: `${k}.pdf`, sizeKb: 1, uploadedAt: NOW }))
const booking = (patch: Partial<BookingInput> = {}): BookingInput => ({
  ...emptyBooking(), bookingDate: '2026-11-10', routeId: 'rt-mny', containers: [{ containerType: '40ft', quantity: 2 }], weightTons: 40, commodity: 'Maize',
  documents: docs, declaration: true, ...patch,
})
const dispatch = (patch: Partial<DispatchInput> = {}): DispatchInput => ({ wagonNumber: 'NRC-FW-30001', trainNumber: 'LI-FR-09', departureDate: '2026-10-20', departureTime: '06:30', loadingYard: 'Apapa Yard A', remarks: '', ...patch })
const checks = { counts: true, cargoAndWeight: true, condition: true, hazardous: true }

describe('train capacity (simulated)', () => {
  it('converts containers to capacity units', () => {
    expect(unitsFor([{ containerType: '20ft', quantity: 2 }, { containerType: '40ft', quantity: 3 }, { containerType: 'Reefer', quantity: 1 }])).toBe(2 + 6 + 2)
    expect(unitsFor([{ containerType: 'Wagon', quantity: 3 }])).toBe(3)
  })
  it('counts live bookings on the route and date, and releases rejected / cancelled ones', () => {
    const d = createSeedData() // bk-0412 = 3×40ft + 1 reefer = 8 units on APP-MNY 2026-10-18
    expect(availability(d, 'rt-mny', '2026-10-18')).toMatchObject({ capacity: 24, used: 8, remaining: 16 })
    get(d, 'bk-0412').status = 'rejected_director'
    expect(availability(d, 'rt-mny', '2026-10-18')).toMatchObject({ used: 0, remaining: 24 })
    expect(availability(d, 'rt-mny', '2026-10-18', 'bk-0412').used).toBe(0)
  })
  it('a maintenance block means no slots; a missing rule means unconstrained', () => {
    const d = createSeedData()
    expect(availability(d, 'rt-ebm', '2026-10-30').blockedReason).toMatch(/maintenance/i)
    expect(loadLevel(availability(d, 'rt-ebm', '2026-10-30'))).toBe('maintenance')
    d.capacity = d.capacity.filter((c) => c.routeId !== 'rt-apl')
    expect(availability(d, 'rt-apl', '2026-10-18').capacity).toBeNull()
    expect(checkCapacity(d, 'rt-apl', '2026-10-18', [{ containerType: '20ft', quantity: 999 }]).ok).toBe(true)
  })
  it('checkCapacity explains why a booking does not fit', () => {
    const d = createSeedData()
    const full = checkCapacity(d, 'rt-mny', '2026-10-18', [{ containerType: '40ft', quantity: 9 }]) // 18 > 16
    expect(!full.ok && full.reason).toMatch(/Only 16 capacity units left/)
    expect(checkCapacity(d, 'rt-mny', '2026-10-18', [{ containerType: '40ft', quantity: 8 }]).ok).toBe(true)
  })
  it('createBooking refuses a full or blocked date and accepts one that fits', () => {
    const d = createSeedData()
    const over = createBooking(d, booking({ bookingDate: '2026-10-18', containers: [{ containerType: '40ft', quantity: 9 }] }), northbound, NOW, TODAY)
    expect(!over.ok && over.error).toMatch(/Only 16/)
    const blocked = createBooking(d, booking({ bookingDate: '2026-11-03' }), northbound, NOW, TODAY)
    expect(!blocked.ok && blocked.error).toMatch(/Signalling works/)
    expect(createBooking(d, booking({ bookingDate: '2026-10-18', containers: [{ containerType: '40ft', quantity: 8 }] }), northbound, NOW, TODAY).ok).toBe(true)
  })
  it('capacity is released when a booking is rejected, so the same booking then fits', () => {
    const d = createSeedData()
    const input = booking({ bookingDate: '2026-10-18', containers: [{ containerType: '40ft', quantity: 12 }] }) // 24 units
    expect(createBooking(d, input, northbound, NOW, TODAY).ok).toBe(false)
    const rejected = ok(directorRejectBooking(d, 'bk-0412', dir, 'Capacity unavailable', NOW)).data // bk-0412 is at the Director stage
    expect(availability(rejected, 'rt-mny', '2026-10-18').used).toBe(0)
    expect(createBooking(rejected, input, northbound, NOW, TODAY).ok).toBe(true)
  })
  it('waitlist: only when there is no room, once per route/date, own entries only', () => {
    const d = createSeedData()
    const full = { routeId: 'rt-ebm', bookingDate: '2026-10-30', containers: [{ containerType: '20ft' as const, quantity: 1 }], commodity: 'Rice' }
    expect(joinWaitlist(d, { ...full, bookingDate: '2026-11-20' }, lagoon, NOW, TODAY).ok).toBe(false) // slots available
    const w = ok(joinWaitlist(d, full, lagoon, NOW, TODAY))
    expect(w.data.waitlist[0]).toMatchObject({ customerId: 'cus-lagoon', status: 'waiting', units: 1 })
    expect(w.data.bookings.length).toBe(d.bookings.length) // not a booking
    expect(joinWaitlist(w.data, full, lagoon, NOW, TODAY).ok).toBe(false)
    expect(joinWaitlist(d, full, dir, NOW, TODAY).ok).toBe(false)
    expect(leaveWaitlist(w.data, w.waitlistId, northbound, NOW).ok).toBe(false)
    expect(ok(leaveWaitlist(w.data, w.waitlistId, lagoon, NOW)).data.waitlist[0]!.status).toBe('cancelled')
  })
  it('Super Admin sets capacity and maintenance blocks (audited); the Director cannot', () => {
    const d = createSeedData()
    expect(setRouteCapacity(d, 'rt-mny', 30, dir, NOW).ok).toBe(false)
    expect(setRouteCapacity(d, 'rt-mny', 0, sa, NOW).ok).toBe(false)
    expect(setRouteCapacity(d, 'rt-mny', 24, sa, NOW).ok).toBe(false) // no change
    const c = ok(setRouteCapacity(d, 'rt-mny', 30, sa, NOW))
    expect(c.data.capacity.find((x) => x.routeId === 'rt-mny')!.dailyUnits).toBe(30)
    expect(c.data.audit.at(-1)!.change).toEqual({ field: 'APP-MNY daily capacity', from: '24 units/day', to: '30 units/day' })
    const b = ok(addMaintenanceBlock(c.data, { routeId: 'rt-apl', date: '2026-11-15', reason: 'Bridge works' }, sa, NOW, TODAY))
    expect(availability(b.data, 'rt-apl', '2026-11-15').remaining).toBe(0)
    expect(addMaintenanceBlock(b.data, { routeId: 'rt-apl', date: '2026-11-15', reason: 'dup' }, sa, NOW, TODAY).ok).toBe(false)
    expect(addMaintenanceBlock(b.data, { routeId: 'rt-apl', date: '2026-10-01', reason: 'past' }, sa, NOW, TODAY).ok).toBe(false)
    expect(addMaintenanceBlock(b.data, { routeId: 'rt-apl', date: '2026-11-16', reason: ' ' }, sa, NOW, TODAY).ok).toBe(false)
    expect(addMaintenanceBlock(b.data, { routeId: 'rt-apl', date: '2026-11-16', reason: 'x' }, dir, NOW, TODAY).ok).toBe(false)
    const r = ok(removeMaintenanceBlock(b.data, b.data.maintenanceBlocks.at(-1)!.id, sa, NOW))
    expect(availability(r.data, 'rt-apl', '2026-11-15').remaining).toBe(30)
  })
})

describe('approval ageing (proposed targets; indicator only)', () => {
  it('classifies waiting time against the target', () => {
    const now = new Date('2026-10-14T12:00:00Z')
    const at = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()
    expect(ageing(at(10), now, 24).level).toBe('ok')
    expect(ageing(at(18), now, 24).level).toBe('due')
    expect(ageing(at(30), now, 24).level).toBe('overdue')
    expect(ageing(at(49), now, 24).level).toBe('escalated')
    expect(ageing(at(55), now, 24).label).toBe('2d 7h')
    expect(ageing(at(5), now, 24).label).toBe('5h')
  })
  it('maps statuses to approval stages; other statuses have none', () => {
    const d = createSeedData()
    expect(bookingStage(get(d, 'bk-0418'))).toBe('bookingCargoHours')
    expect(bookingStage(get(d, 'bk-0412'))).toBe('bookingDirectorHours')
    expect(bookingStage(get(d, 'bk-0398'))).toBe('dispatchHours')
    expect(bookingStage(get(d, 'bk-0401'))).toBeNull() // awaiting payment has its own window
    expect(registrationStage(d.applications.find((a) => a.id === 'reg-ogun')!)).toBe('registrationDistrictHours')
    expect(registrationStage(d.applications.find((a) => a.id === 'reg-transsahel')!)).toBe('registrationDirectorHours')
    expect(registrationStage(d.applications.find((a) => a.id === 'reg-lagoon')!)).toBeNull()
  })
  it('measures from when the item entered its current status', () => {
    const d = createSeedData()
    expect(waitingSince(d, 'booking', 'bk-0412', 'pending_director_review', 'x')).toBe(d.audit.filter((e) => e.entityId === 'bk-0412' && e.toStatus === 'pending_director_review').at(-1)!.at)
    expect(waitingSince(d, 'booking', 'bk-0412', 'no_such_status', 'fallback')).toBe('fallback')
    const age = bookingAgeing(d, get(d, 'bk-0412'), new Date('2026-10-14T12:00:00+01:00'))!
    expect(age.targetHours).toBe(48)
    expect(registrationAgeing(d, d.applications.find((a) => a.id === 'reg-lagoon')!)).toBeNull()
  })
  it('targets are configurable, validated and audited', () => {
    const d = createSeedData()
    expect(validateConfig({ ...d.config, sla: { ...d.config.sla, dispatchHours: 0 } })).not.toBeNull()
    const r = ok(updateConfig(d, { ...d.config, sla: { ...d.config.sla, dispatchHours: 12 } }, sa, NOW))
    expect(r.data.config.sla.dispatchHours).toBe(12)
    expect(r.data.audit.at(-1)!.change!.field).toBe('sla')
    expect(updateConfig(d, { ...d.config, sla: { ...d.config.sla, dispatchHours: 12 } }, dir, NOW).ok).toBe(false)
  })
})

describe('AWB amendment and verification', () => {
  const withAwb = () => ok(approveDispatch(createSeedData(), 'bk-0398', dispatch(), checks, hop, NOW, TODAY)).data

  it('issues a new version of the same number and keeps the superseded version on record', () => {
    const d = withAwb()
    const v1 = get(d, 'bk-0398').awb!
    const r = ok(amendAwb(d, 'bk-0398', dispatch({ trainNumber: 'LI-FR-12' }), 'Train replaced', hop, '2026-10-14T11:00:00+01:00', TODAY))
    const b = get(r.data, 'bk-0398')
    expect(r.version).toBe(2)
    expect(b.awb).toMatchObject({ number: v1.number, version: 2, amendmentReason: 'Train replaced' })
    expect(b.awbHistory).toEqual([{ ...v1, supersededAt: '2026-10-14T11:00:00+01:00' }])
    expect(b.dispatch!.trainNumber).toBe('LI-FR-12')
    expect(r.data.audit.at(-1)).toMatchObject({ remarks: 'Train replaced', change: { field: 'AWB dispatch details', from: 'v1' } })
    expect(r.data.counters.nextAwbSeq).toBe(d.counters.nextAwbSeq) // no new number consumed
  })
  it('needs a reason, a real change, the Head of Port, and a booking not yet completed', () => {
    const d = withAwb()
    expect(amendAwb(d, 'bk-0398', dispatch({ trainNumber: 'X' }), ' ', hop, NOW, TODAY).ok).toBe(false)
    expect(amendAwb(d, 'bk-0398', dispatch(), 'no change', hop, NOW, TODAY).ok).toBe(false)
    expect(amendAwb(d, 'bk-0398', dispatch({ trainNumber: 'X' }), 'r', dir, NOW, TODAY).ok).toBe(false)
    expect(amendAwb(d, 'bk-0398', dispatch({ wagonNumber: '' }), 'r', hop, NOW, TODAY).ok).toBe(false)
    const done = ok(completeBooking(d, 'bk-0398', hop, NOW)).data
    expect(amendAwb(done, 'bk-0398', dispatch({ trainNumber: 'X' }), 'r', hop, NOW, TODAY).ok).toBe(false)
    expect(amendAwb(createSeedData(), 'bk-0398', dispatch({ trainNumber: 'X' }), 'r', hop, NOW, TODAY).ok).toBe(false) // no AWB yet
  })
  it('verification: current is valid, old version superseded, forged number invalid, unknown not found', () => {
    const d = ok(amendAwb(withAwb(), 'bk-0398', dispatch({ trainNumber: 'LI-FR-12' }), 'Train replaced', hop, NOW, TODAY)).data
    const n = get(d, 'bk-0398').awb!.number
    expect(verifyAwb(d.bookings, n).status).toBe('valid')
    expect(verifyAwb(d.bookings, n, 2).status).toBe('valid')
    expect(verifyAwb(d.bookings, n, 1)).toMatchObject({ status: 'superseded', currentVersion: 2 })
    expect(verifyAwb(d.bookings, n, 7).status).toBe('not_found')
    expect(verifyAwb(d.bookings, n.slice(0, -1) + ((Number(n.slice(-1)) + 1) % 10)).status).toBe('invalid_number')
    expect(verifyAwb(d.bookings, 'NRC-AWB-26-999999-1').status).toMatch(/invalid_number|not_found/)
    expect(verifyAwb(d.bookings, 'garbage').status).toBe('invalid_number')
    expect(verifyAwb(d.bookings, n.toLowerCase()).status).toBe('valid')
  })
})

describe('refund reversal', () => {
  const processed = () => {
    let d = createSeedData()
    d = ok(triggerRefund(d, 'rf-0380', dir, NOW)).data
    d = ok(submitRefundRequest(d, 'rf-0380', { bankName: 'Demo Bank', accountName: 'Lagoon', accountNumber: '0123456789', confirmedAmount: d.refunds[0]!.amount, policyAcknowledged: true }, lagoon, NOW)).data
    for (const s of ['review', 'approve', 'process'] as const) d = ok(advanceRefund(d, 'rf-0380', s, sa, NOW)).data
    return d
  }
  it('adds a separate reversing entry and never edits the original refund', () => {
    const d = processed()
    const before = JSON.stringify(d.refunds)
    const r = ok(reverseRefund(d, 'rf-0380', 'Paid to the wrong account', sa, '2026-10-15T09:00:00+01:00'))
    expect(JSON.stringify(r.data.refunds)).toBe(before)
    expect(r.data.refundReversals).toEqual([{ id: 'rv-rf-0380', refundId: 'rf-0380', reason: 'Paid to the wrong account', reference: 'DEMO-RVRS-0380', at: '2026-10-15T09:00:00+01:00', byName: 'Tunde Bakare' }])
    expect(r.data.audit.at(-1)).toMatchObject({ entityType: 'refund', actorRole: 'super_admin' })
  })
  it('only a processed refund, only once, only Super Admin, with a reason', () => {
    const d = processed()
    expect(reverseRefund(createSeedData(), 'rf-0380', 'x', sa, NOW).ok).toBe(false) // not processed
    expect(reverseRefund(d, 'rf-0380', 'x', dir, NOW).ok).toBe(false)
    expect(reverseRefund(d, 'rf-0380', ' ', sa, NOW).ok).toBe(false)
    expect(reverseRefund(ok(reverseRefund(d, 'rf-0380', 'x', sa, NOW)).data, 'rf-0380', 'again', sa, NOW).ok).toBe(false)
  })
})
