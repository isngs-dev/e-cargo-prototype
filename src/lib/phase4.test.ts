import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { buildMail } from '@/lib/mail'
import { sampleContainerPhoto } from '@/lib/photos'
import { findTrain, nextDeparture, trainDefaults, trains } from '@/lib/trains'
import { MAX_PHOTOS, saveContainerPhotos } from '@/lib/workflow/dispatch'
import type { Actor } from '@/lib/workflow/result'

const hop: Actor = { name: 'Grace Etim', role: 'head_port_operations' }
const photo = (n = 1) => ({ fileName: `c${n}.jpg`, dataUrl: sampleContainerPhoto(n), caption: `Photo ${n}` })

describe('train timetable autofill', () => {
  it('knows the demo trains, ignoring case and spaces', () => {
    expect(findTrain(' li-fr-11 ')?.departureTime).toBe('06:30')
    expect(findTrain('LI-FR-99')).toBeUndefined()
    expect(trains.length).toBeGreaterThanOrEqual(4)
  })
  it('fills time, yard and the next running day on or after the earliest date', () => {
    // LI-FR-07 runs Mon / Wed / Fri. 14 Oct 2026 is a Wednesday.
    expect(trainDefaults('LI-FR-07', '2026-10-14')).toEqual({ departureDate: '2026-10-14', departureTime: '06:30', loadingYard: 'Apapa Yard B' })
    expect(nextDeparture(findTrain('LI-FR-07')!, '2026-10-15')).toBe('2026-10-16')
    expect(nextDeparture(findTrain('LI-FR-07')!, '2026-10-17')).toBe('2026-10-19')
    expect(trainDefaults('NOPE', '2026-10-14')).toBeNull()
  })
})

describe('container photos (append-only: confirm, then re-upload)', () => {
  const d = createSeedData()
  const add = (...ns: number[]) => ({ add: ns.map((n) => photo(n)) })
  it('seed has sample photos on dispatched bookings, as inline images', () => {
    expect(d.bookings.find((b) => b.id === 'bk-0390')!.photos!.length).toBe(3)
    expect(sampleContainerPhoto(2)).toMatch(/^data:image\/svg\+xml/)
  })
  it('only the Head of Port confirms photos, while the booking is awaiting dispatch or dispatched', () => {
    const ok = saveContainerPhotos(d, 'bk-0398', add(1, 2), hop)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    const b = ok.data.bookings.find((x) => x.id === 'bk-0398')!
    expect(b.photos).toHaveLength(2)
    expect(b.photos![0]).toMatchObject({ addedBy: 'Grace Etim', caption: 'Photo 1', batch: 1 })
    for (const role of ['cargo_facilitator', 'head_of_cargo', 'director_operations', 'managing_director', 'super_admin'] as const) {
      expect(saveContainerPhotos(d, 'bk-0398', add(1), { name: 'x', role }).ok).toBe(false)
    }
    expect(saveContainerPhotos(d, 'bk-0401', add(1), hop).ok).toBe(false) // awaiting payment
    expect(saveContainerPhotos(d, 'bk-0377', add(1), hop).ok).toBe(false) // completed
    expect(saveContainerPhotos(d, 'bk-0390', add(1), hop).ok).toBe(true) // AWB generated
  })
  it('photos are never deleted: a re-upload adds a new batch and keeps every earlier photo; one timeline entry per confirmation', () => {
    const before = d.audit.length
    const first = saveContainerPhotos(d, 'bk-0398', add(1, 2), hop)
    if (!first.ok) throw new Error(first.error)
    expect(first.data.audit).toHaveLength(before + 1)
    expect(first.data.audit.at(-1)).toMatchObject({ entityId: 'bk-0398', action: 'Container photos uploaded (2 photos; 2 on file)' })
    const second = saveContainerPhotos(first.data, 'bk-0398', add(3), hop)
    if (!second.ok) throw new Error(second.error)
    expect(second.data.audit).toHaveLength(before + 2)
    expect(second.data.audit.at(-1)!.action).toBe('Container photos re-uploaded (1 new; 2 earlier kept; 3 on file)')
    const photos = second.data.bookings.find((b) => b.id === 'bk-0398')!.photos!
    expect(photos.map((p) => p.caption)).toEqual(['Photo 1', 'Photo 2', 'Photo 3'])
    expect(photos.map((p) => p.batch)).toEqual([1, 1, 2])
    const third = saveContainerPhotos(second.data, 'bk-0398', add(4, 5), hop)
    expect(third.ok && third.data.bookings.find((b) => b.id === 'bk-0398')!.photos!.map((p) => p.batch)).toEqual([1, 1, 2, 3, 3])
    // seeded photos (batch 1) count as the first upload, so a re-upload on them is batch 2
    const reup = saveContainerPhotos(d, 'bk-0390', add(9), hop)
    expect(reup.ok && reup.data.bookings.find((b) => b.id === 'bk-0390')!.photos!.at(-1)!.batch).toBe(2)
  })
  it('there is no way to remove a photo, and bad confirmations are refused', () => {
    expect(saveContainerPhotos(d, 'bk-0398', { add: [] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'a.pdf', dataUrl: 'data:application/pdf;base64,AAAA', caption: '' }] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'big.jpg', dataUrl: `data:image/jpeg;base64,${'A'.repeat(500_000)}`, caption: '' }] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', add(...Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => i)), hop).ok).toBe(false)
    expect(Object.keys({ ...saveContainerPhotos }).length).toBe(0)
  })
})

describe('customer emails do not repeat the Director’s reasons', () => {
  it('the approval email carries no remarks, while the reviewer-only discount entry keeps its reason', () => {
    const d = createSeedData()
    const mail = buildMail(d)
    const approval = mail.find((m) => m.entityId === 'bk-0405' && m.subject.includes('Approved'))!
    expect(approval.body.some((l) => l.startsWith('Remarks:'))).toBe(false)
    expect(approval.body.join(' ')).not.toContain('volume below committed tonnage')
    const approvalEntry = d.audit.find((e) => e.entityId === 'bk-0405' && e.toStatus === 'credit_approved')!
    expect(approvalEntry.remarks).toContain('volume below committed tonnage') // still on the record for reviewers
  })
})
