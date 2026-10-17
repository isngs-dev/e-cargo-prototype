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

describe('container photos (draft, then confirm)', () => {
  const d = createSeedData()
  const add = (...ns: number[]) => ({ add: ns.map((n) => photo(n)), removeIds: [] as string[] })
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
    expect(b.photos![0]).toMatchObject({ addedBy: 'Grace Etim', caption: 'Photo 1' })
    for (const role of ['cargo_facilitator', 'head_of_cargo', 'director_operations', 'managing_director', 'super_admin'] as const) {
      expect(saveContainerPhotos(d, 'bk-0398', add(1), { name: 'x', role }).ok).toBe(false)
    }
    expect(saveContainerPhotos(d, 'bk-0401', add(1), hop).ok).toBe(false) // awaiting payment
    expect(saveContainerPhotos(d, 'bk-0377', add(1), hop).ok).toBe(false) // completed
    expect(saveContainerPhotos(d, 'bk-0390', add(1), hop).ok).toBe(true) // AWB generated
  })
  it('one confirmation is one timeline entry, however many pictures changed, and it counts added and removed', () => {
    const before = d.audit.length
    const first = saveContainerPhotos(d, 'bk-0398', add(1, 2, 3), hop)
    if (!first.ok) throw new Error(first.error)
    expect(first.data.audit).toHaveLength(before + 1)
    expect(first.data.audit.at(-1)).toMatchObject({ entityId: 'bk-0398', action: 'Container photos confirmed (3 added; 3 on file)' })
    const ids = first.data.bookings.find((b) => b.id === 'bk-0398')!.photos!.map((p) => p.id)
    const second = saveContainerPhotos(first.data, 'bk-0398', { add: [photo(4), photo(5)], removeIds: [ids[0]!] }, hop)
    if (!second.ok) throw new Error(second.error)
    expect(second.data.audit).toHaveLength(before + 2)
    expect(second.data.audit.at(-1)!.action).toBe('Container photos confirmed (2 added, 1 removed; 4 on file)')
    expect(second.data.bookings.find((b) => b.id === 'bk-0398')!.photos!.map((p) => p.caption)).toEqual(['Photo 2', 'Photo 3', 'Photo 4', 'Photo 5'])
    const removeOnly = saveContainerPhotos(second.data, 'bk-0398', { add: [], removeIds: [ids[1]!] }, hop)
    expect(removeOnly.ok && removeOnly.data.audit.at(-1)!.action).toBe('Container photos confirmed (1 removed; 3 on file)')
  })
  it('rejects empty confirmations, non-images, oversized images, over-the-limit and unknown removals', () => {
    expect(saveContainerPhotos(d, 'bk-0398', { add: [], removeIds: [] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'a.pdf', dataUrl: 'data:application/pdf;base64,AAAA', caption: '' }], removeIds: [] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'big.jpg', dataUrl: `data:image/jpeg;base64,${'A'.repeat(500_000)}`, caption: '' }], removeIds: [] }, hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', add(...Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => i)), hop).ok).toBe(false)
    expect(saveContainerPhotos(d, 'bk-0398', { add: [], removeIds: ['nope'] }, hop).ok).toBe(false)
    // removing one and adding one at the limit is fine
    const full = saveContainerPhotos(d, 'bk-0398', add(...Array.from({ length: MAX_PHOTOS }, (_, i) => i)), hop)
    if (!full.ok) throw new Error(full.error)
    const firstId = full.data.bookings.find((b) => b.id === 'bk-0398')!.photos![0]!.id
    expect(saveContainerPhotos(full.data, 'bk-0398', add(99), hop).ok).toBe(false)
    expect(saveContainerPhotos(full.data, 'bk-0398', { add: [photo(99)], removeIds: [firstId] }, hop).ok).toBe(true)
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
