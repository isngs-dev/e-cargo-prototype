import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { newestFirst, ts, visibleApplications, visibleBookings } from '@/app/selectors'
import { personas } from '@/data/personas'

describe('newest first', () => {
  it('compares real instants, not text: a fresh UTC entry beats an older +01:00 one', () => {
    const rows = [{ id: 'old', at: '2026-10-13T09:40:00+01:00' }, { id: 'fresh', at: '2026-10-14T10:00:00.000Z' }, { id: 'mid', at: '2026-10-14T08:00:00+01:00' }]
    expect(newestFirst(rows, (r) => r.at).map((r) => r.id)).toEqual(['fresh', 'mid', 'old'])
    expect(ts(undefined)).toBe(0)
  })
  it('a brand-new booking and registration appear first for the roles that list them', () => {
    const d = createSeedData()
    const fresh = '2026-10-16T09:00:00.000Z'
    const b = { ...d.bookings[0]!, id: 'bk-new', reference: 'NRC-BK-2026-0421', createdAt: fresh }
    const a = { ...d.applications[0]!, id: 'reg-new', reference: 'REG-2026-0108', submittedAt: fresh }
    const data = { ...d, bookings: [...d.bookings, b], applications: [...d.applications, a] }
    const director = personas.find((p) => p.role === 'director_operations')!
    expect(visibleBookings(data, director)[0]!.id).toBe('bk-new')
    expect(visibleApplications(data, director)[0]!.id).toBe('reg-new')
  })
})
