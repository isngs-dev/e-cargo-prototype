import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { rememberBase, returnsAfterDecision, returnTarget } from '@/app/returnTarget'
import { addBookingRemark, hocApproveBooking } from '@/lib/workflow/bookingApproval'
import { amendAwb, approveDispatch, emptyDispatch, saveContainerPhotos } from '@/lib/workflow/dispatch'
import type { AppData } from '@/types/domain'

describe('returning after a decision', () => {
  it('applies to the four officer roles only — not Super Admin, Managing Director or customers', () => {
    for (const r of ['district_supervisor', 'head_of_cargo', 'director_operations', 'head_port_operations'] as const) expect(returnsAfterDecision(r)).toBe(true)
    for (const r of ['super_admin', 'managing_director', 'cargo_facilitator'] as const) expect(returnsAfterDecision(r)).toBe(false)
  })
  it('falls back to a sensible list page for each role when nothing was remembered', () => {
    // No browser storage in this test environment, so the role default is used.
    expect(returnTarget('district_supervisor')).toBe('/registrations')
    expect(returnTarget('head_of_cargo')).toBe('/bookings')
    expect(returnTarget('director_operations')).toBe('/dashboard')
    expect(returnTarget('head_port_operations')).toBe('/dispatch')
    expect(() => rememberBase('/bookings/bk-0418')).not.toThrow()
  })
})

describe('only final decisions change a status (so only they return the officer)', () => {
  const hoc = { name: 'Funmilayo Adebayo', role: 'head_of_cargo' as const }
  const hop = { name: 'Grace Etim', role: 'head_port_operations' as const }
  const statusOf = (d: AppData, id: string) => d.bookings.find((b) => b.id === id)!.status

  it('final decisions move the status; remarks, photos and AWB amendments do not', () => {
    const d = createSeedData()
    // final: forward to the Director
    const forwarded = hocApproveBooking(d, 'bk-0418', hoc)
    expect(forwarded.ok && statusOf(forwarded.data, 'bk-0418')).not.toBe(statusOf(d, 'bk-0418'))
    // not final: an internal remark
    const remark = addBookingRemark(d, 'bk-0418', hoc, 'Looks fine')
    expect(remark.ok && statusOf(remark.data, 'bk-0418')).toBe(statusOf(d, 'bk-0418'))
    // not final: confirming container photos
    const photos = saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'a.jpg', dataUrl: 'data:image/jpeg;base64,AAAA', caption: 'x' }], removeIds: [] }, hop)
    expect(photos.ok && statusOf(photos.data, 'bk-0398')).toBe(statusOf(d, 'bk-0398'))
    // not final: amending an issued AWB (stays on the page for now)
    const b = d.bookings.find((x) => x.id === 'bk-0390')!
    const amended = amendAwb(d, 'bk-0390', { ...emptyDispatch(), ...b.dispatch!, trainNumber: 'LI-FR-12', loadingYard: b.dispatch!.loadingYard ?? '', remarks: '' }, 'Train changed', hop, '2026-10-14T10:00:00+01:00', '2026-10-01')
    expect(amended.ok && statusOf(amended.data, 'bk-0390')).toBe(statusOf(d, 'bk-0390'))
    // final: approving dispatch moves a booking on
    const dispatched = approveDispatch(d, 'bk-0398', { wagonNumber: 'NRC-FW-1', trainNumber: 'LI-FR-11', departureDate: '2026-12-01', departureTime: '06:30', loadingYard: '', remarks: '' }, { counts: true, cargoAndWeight: true, condition: true, hazardous: true }, hop, '2026-10-14T10:00:00+01:00', '2026-10-01')
    expect(dispatched.ok && statusOf(dispatched.data, 'bk-0398')).toBe('awb_generated')
  })
})
