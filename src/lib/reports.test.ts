import { describe, expect, it } from 'vitest'
import appSource from '@/App.tsx?raw'
import guardSource from '@/features/placeholder/PlannedPage.tsx?raw'
import { createSeedData } from '@/app/state'
import { navForPersona } from '@/app/navigation'
import { personas } from '@/data/personas'
import { canAccess, canAccessPersona } from '@/lib/permissions'
import { addDays, buildReport, DEFAULT_FILTERS, dayKey, latestActivity, pctChange, resolveRange, type ReportFilters } from '@/lib/reports'
import type { AppData, Booking, Role } from '@/types/domain'

const ALL: ReportFilters = { ...DEFAULT_FILTERS, range: 'all' }
const f = (patch: Partial<ReportFilters> = {}): ReportFilters => ({ ...ALL, ...patch })
const received = (b: Booking) => !!b.approved && (b.payment.status === 'paid' || b.payment.status === 'credit_settled')
const setBooking = (d: AppData, id: string, patch: Partial<Booking>): AppData => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

describe('report date ranges', () => {
  const asOf = '2026-10-14T10:00:00+01:00'
  it('resolves every preset from the latest data, using Lagos calendar days', () => {
    expect(resolveRange(f({ range: 'today' }), asOf)).toMatchObject({ fromDate: '2026-10-14', toDate: '2026-10-14' })
    expect(resolveRange(f({ range: 'last_7' }), asOf)).toMatchObject({ fromDate: '2026-10-08', toDate: '2026-10-14' })
    expect(resolveRange(f({ range: 'last_30' }), asOf)).toMatchObject({ fromDate: '2026-09-15', toDate: '2026-10-14' })
    expect(resolveRange(f({ range: 'this_month' }), asOf)).toMatchObject({ fromDate: '2026-10-01', toDate: '2026-10-14' })
    expect(resolveRange(f({ range: 'this_quarter' }), asOf)).toMatchObject({ fromDate: '2026-10-01' })
    expect(resolveRange(f({ range: 'this_quarter' }), '2026-08-20T09:00:00+01:00')).toMatchObject({ fromDate: '2026-07-01', toDate: '2026-08-20' })
  })
  it('custom ranges swap reversed bounds; open-ended and all-time ranges have no comparison period', () => {
    expect(resolveRange(f({ range: 'custom', from: '2026-09-30', to: '2026-09-01' }), asOf)).toMatchObject({ fromDate: '2026-09-01', toDate: '2026-09-30' })
    expect(resolveRange(f({ range: 'custom', from: '2026-09-01', to: '' }), asOf).previous).toBeNull()
    expect(resolveRange(f({ range: 'all' }), asOf)).toMatchObject({ fromDate: null, toDate: null, previous: null })
  })
  it('the previous period is the equal-length window immediately before', () => {
    expect(resolveRange(f({ range: 'last_7' }), asOf).previous).toEqual({ fromDate: '2026-10-01', toDate: '2026-10-07' })
    expect(resolveRange(f({ range: 'today' }), asOf).previous).toEqual({ fromDate: '2026-10-13', toDate: '2026-10-13' })
  })
  it('day boundaries follow Lagos time (UTC+1)', () => {
    expect(dayKey('2026-10-14T23:30:00Z')).toBe('2026-10-15')
    expect(dayKey('2026-10-14T22:30:00Z')).toBe('2026-10-14')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('the "as of" moment is the latest activity in the data', () => {
    const d = createSeedData()
    const latest = latestActivity(d)
    for (const b of d.bookings) expect(Date.parse(latest)).toBeGreaterThanOrEqual(Date.parse(b.createdAt))
    expect(latestActivity({ ...d, applications: [], bookings: [], refunds: [], audit: [] })).toMatch(/^\d{4}-/)
  })
})

describe('report KPIs and date filtering', () => {
  const d = createSeedData()
  it('counts come straight from the data (no invented numbers)', () => {
    const r = buildReport(d, ALL)
    expect(r.kpis.registrations.current).toBe(d.applications.length)
    expect(r.kpis.bookings.current).toBe(d.bookings.filter((b) => b.status !== 'draft').length)
    expect(r.kpis.awbs.current).toBe(d.bookings.filter((b) => b.awb).length)
    expect(r.awbRows).toHaveLength(r.kpis.awbs.current)
    expect(r.bookingRows).toHaveLength(r.kpis.bookings.current)
    expect(r.registrationRows).toHaveLength(r.kpis.registrations.current)
  })
  it('a date range keeps only records inside it, and trends add up to the totals', () => {
    const r = buildReport(d, f({ range: 'custom', from: '2026-09-01', to: '2026-09-30' }))
    const expected = d.bookings.filter((b) => dayKey(b.createdAt) >= '2026-09-01' && dayKey(b.createdAt) <= '2026-09-30').length
    expect(r.kpis.bookings.current).toBe(expected)
    expect(r.series.reduce((a, p) => a + p.bookings, 0)).toBe(expected)
    expect(r.series.reduce((a, p) => a + p.awbs, 0)).toBe(r.kpis.awbs.current)
    expect(r.series.reduce((a, p) => a + p.revenue, 0)).toBe(r.kpis.gross.current)
  })
  it('compares with the previous equivalent period only when one exists, never inventing a percentage', () => {
    const bounded = buildReport(d, f({ range: 'custom', from: '2026-09-01', to: '2026-09-30' }))
    expect(bounded.comparable).toBe(true)
    expect(bounded.kpis.bookings.previous).toBe(d.bookings.filter((b) => dayKey(b.createdAt) >= '2026-08-02' && dayKey(b.createdAt) <= '2026-08-31').length)
    const all = buildReport(d, ALL)
    expect(all.comparable).toBe(false)
    expect(all.kpis.gross.previous).toBeNull()
    expect(all.kpis.gross.pct).toBeNull()
    expect(pctChange(10, 0)).toBeNull()
    expect(pctChange(15, 10)).toBe(50)
    expect(pctChange(5, null)).toBeNull()
  })
  it('chooses a daily, weekly or monthly bucket from the span', () => {
    expect(buildReport(d, f({ range: 'last_7' })).unit).toBe('day')
    expect(buildReport(d, f({ range: 'last_30' })).unit).toBe('week')
    expect(buildReport(d, f({ range: 'custom', from: '2026-07-01', to: '2026-09-15' })).unit).toBe('week')
    expect(buildReport(d, ALL).unit).toBe('month')
  })
})

describe('district filtering', () => {
  const d = createSeedData()
  it('Lagos + Ibadan add up to All districts, for registrations, bookings, AWBs and revenue', () => {
    const all = buildReport(d, ALL)
    const lagos = buildReport(d, f({ district: 'Lagos' }))
    const ibadan = buildReport(d, f({ district: 'Ibadan' }))
    for (const k of ['registrations', 'bookings', 'awbs'] as const) expect(lagos.kpis[k].current + ibadan.kpis[k].current).toBe(all.kpis[k].current)
    expect(lagos.kpis.gross.current + ibadan.kpis.gross.current).toBe(all.kpis.gross.current)
    expect(ibadan.kpis.registrations.current).toBeGreaterThan(0)
    expect(ibadan.kpis.bookings.current).toBeGreaterThan(0)
  })
  it('district comes from the customer, not the route: an Ibadan customer booking on a Lagos route is Ibadan', () => {
    const b = d.bookings.find((x) => x.id === 'bk-0395')! // Northbound (Ibadan) on Apapa → Ebute Metta
    expect(d.customers.find((c) => c.id === b.customerId)!.district).toBe('Ibadan')
    expect(buildReport(d, f({ district: 'Ibadan' })).bookingRows.map((r) => r.id)).toContain('bk-0395')
    expect(buildReport(d, f({ district: 'Lagos' })).bookingRows.map((r) => r.id)).not.toContain('bk-0395')
  })
  it('the by-district comparison matches the filtered totals', () => {
    const all = buildReport(d, ALL)
    expect(all.byDistrict.map((x) => x.district)).toEqual(['Lagos', 'Ibadan'])
    expect(all.byDistrict.reduce((a, x) => a + x.revenue, 0)).toBe(all.kpis.gross.current)
    const ibadan = buildReport(d, f({ district: 'Ibadan' }))
    expect(ibadan.byDistrict.find((x) => x.district === 'Lagos')).toMatchObject({ registrations: 0, bookings: 0, awbs: 0, revenue: 0 })
  })
})

describe('status mapping and other filters', () => {
  const d = createSeedData()
  it('every status slice uses a real workflow status and the slices sum to the totals', () => {
    const r = buildReport(d, ALL)
    expect(r.registrationStatus.reduce((a, s) => a + s.count, 0)).toBe(r.kpis.registrations.current)
    expect(r.bookingStatus.reduce((a, s) => a + s.count, 0)).toBe(r.kpis.bookings.current)
    const regKeys = new Set(d.applications.map((a) => a.status))
    for (const s of r.registrationStatus) expect(regKeys.has(s.key as never)).toBe(true)
    expect(r.kpis.registrations.approved).toBe(d.applications.filter((a) => a.status === 'activated').length)
    expect(r.kpis.registrations.pending).toBe(d.applications.filter((a) => ['pending_district_verification', 'pending_director_approval', 'sent_back_to_district'].includes(a.status)).length)
    expect(r.registrationRows.find((x) => x.status === 'pending_director_approval')!.stage).toBe('Director')
    expect(r.registrationRows.find((x) => x.status === 'sent_back_to_facilitator')!.stage).toBe('Applicant')
  })
  it('payment status, route and booking status filters narrow bookings, AWBs and revenue — never registrations', () => {
    const base = buildReport(d, ALL)
    const paid = buildReport(d, f({ paymentStatus: 'paid' }))
    expect(paid.kpis.registrations.current).toBe(base.kpis.registrations.current)
    expect(paid.bookingRows.every((r) => r.paymentStatus === 'paid')).toBe(true)
    expect(paid.kpis.gross.current).toBeLessThan(base.kpis.gross.current) // credit-settled revenue is excluded by the filter
    const route = buildReport(d, f({ routeId: 'rt-mny' }))
    expect(route.bookingRows.every((r) => r.route.includes('Moniya'))).toBe(true)
    expect(route.kpis.registrations.current).toBe(base.kpis.registrations.current)
    const completed = buildReport(d, f({ bookingStatus: 'completed' }))
    expect(completed.bookingRows.every((r) => r.status === 'completed')).toBe(true)
  })
  it('splits approved customers and bookings by Priority vs Non-Priority from real eligibility', () => {
    const r = buildReport(d, ALL)
    expect(r.priority.bookings.priority + r.priority.bookings.nonPriority).toBe(r.kpis.bookings.current)
    expect(r.priority.customersApproved.priority + r.priority.customersApproved.nonPriority + r.priority.customersApproved.unclassified).toBe(r.kpis.registrations.approved)
    expect(r.priority.revenue.priority + r.priority.revenue.nonPriority).toBe(r.kpis.gross.current)
  })
})

describe('revenue accuracy', () => {
  const d = createSeedData()
  it('revenue received is exactly the frozen total of paid / credit-settled bookings', () => {
    const expected = d.bookings.filter(received).reduce((a, b) => a + b.approved!.price.totalPayable, 0)
    expect(expected).toBeGreaterThan(0)
    expect(buildReport(d, ALL).kpis.gross.current).toBe(expected)
  })
  it('never counts unpaid, awaiting-payment, credit-outstanding, cancelled or indicative amounts', () => {
    const r = buildReport(d, ALL)
    const paidRefs = new Set(r.paymentRows.map((p) => p.reference))
    for (const b of d.bookings) {
      if (!received(b)) expect(paidRefs.has(b.reference)).toBe(false)
    }
    const unpaid = d.bookings.find((b) => b.status === 'awaiting_payment')!
    const credit = d.bookings.find((b) => b.payment.status === 'credit_outstanding')!
    expect(paidRefs.has(unpaid.reference)).toBe(false)
    expect(paidRefs.has(credit.reference)).toBe(false)
    expect(r.kpis.awaitingPayment.amount).toBe(d.bookings.filter((b) => b.status === 'awaiting_payment' && b.approved).reduce((a, b) => a + b.approved!.price.totalPayable, 0))
    expect(r.kpis.creditExposure.amount).toBe(d.bookings.filter((b) => b.payment.status === 'credit_outstanding' && b.approved).reduce((a, b) => a + b.approved!.price.totalPayable, 0))
  })
  it('marking a booking paid adds its amount exactly once; a payment in the exception queue is never double-counted', () => {
    const before = buildReport(d, ALL).kpis.gross.current
    const target = d.bookings.find((b) => b.status === 'awaiting_payment' && b.payment.status === 'pending')!
    const paid = setBooking(d, target.id, { status: 'pending_dispatch', payment: { ...target.payment, status: 'paid', paidAt: '2026-10-14T12:00:00+01:00' } })
    const after = buildReport(paid, ALL)
    expect(after.kpis.gross.current).toBe(before + target.approved!.price.totalPayable)
    expect(after.paymentRows.filter((p) => p.bookingId === target.id)).toHaveLength(1)
    const withDuplicate: AppData = { ...paid, paymentExceptions: [...paid.paymentExceptions, { id: 'px-dup', reference: 'DUP', amount: target.approved!.price.totalPayable, receivedAt: '2026-10-14T12:05:00+01:00', issue: 'Duplicate', bookingId: target.id, resolved: false }] }
    expect(buildReport(withDuplicate, ALL).kpis.gross.current).toBe(after.kpis.gross.current)
  })
  it('revenue is dated by the payment date, not the booking date', () => {
    const b = d.bookings.find((x) => x.id === 'bk-0377')! // booked in September, paid 24 Sep
    const sep = buildReport(d, f({ range: 'custom', from: '2026-09-24', to: '2026-09-24' }))
    expect(sep.paymentRows.map((p) => p.bookingId)).toContain(b.id)
    const oct = buildReport(d, f({ range: 'custom', from: '2026-10-01', to: '2026-10-14' }))
    expect(oct.paymentRows.map((p) => p.bookingId)).not.toContain(b.id)
  })
  it('splits revenue by payment terms without losing or adding money', () => {
    const r = buildReport(d, ALL)
    expect(r.revenueByTerms.payNow + r.revenueByTerms.credit).toBe(r.kpis.gross.current)
    expect(r.revenueByTerms.credit).toBeGreaterThan(0)
  })
})

describe('refunds and net revenue', () => {
  const d = createSeedData()
  it('only processed, unreversed refunds are subtracted; net = gross − refunds', () => {
    const r = buildReport(d, ALL)
    const processed = d.refunds.filter((x) => x.status === 'processed')
    expect(processed.length).toBeGreaterThan(0)
    expect(r.kpis.refunds.current).toBe(processed.reduce((a, x) => a + x.amount, 0))
    expect(r.kpis.net.current).toBe(r.kpis.gross.current - r.kpis.refunds.current)
    const awaiting = d.refunds.find((x) => x.status === 'awaiting_director')!
    expect(r.kpis.refunds.current).not.toBe(r.kpis.refunds.current + awaiting.amount)
    expect(processed.some((x) => x.id === awaiting.id)).toBe(false)
  })
  it('a reversed refund is no longer deducted', () => {
    const base = buildReport(d, ALL)
    const reversed = buildReport({ ...d, refundReversals: [{ id: 'rv-1', refundId: 'rf-0352', reason: 'test', reference: 'R', at: '2026-10-14T09:00:00+01:00', byName: 'Tunde Bakare' }] }, ALL)
    expect(reversed.kpis.refunds.current).toBe(0)
    expect(reversed.kpis.net.current).toBe(base.kpis.gross.current)
    expect(reversed.paymentRows.find((p) => p.bookingId === 'bk-0352')!.refund).toBe('Reversed')
  })
  it('refund dates and filters follow the refund, and the payment table shows its refund status', () => {
    const inSep = buildReport(d, f({ range: 'custom', from: '2026-09-15', to: '2026-09-15' }))
    expect(inSep.kpis.refunds.current).toBeGreaterThan(0)
    expect(buildReport(d, f({ range: 'custom', from: '2026-09-16', to: '2026-09-30' })).kpis.refunds.current).toBe(0)
    expect(buildReport(d, f({ district: 'Ibadan' })).kpis.refunds.current).toBe(0)
    expect(buildReport(d, ALL).paymentRows.find((p) => p.bookingId === 'bk-0352')).toMatchObject({ refund: 'Processed' })
  })
})

describe('empty and incomplete data', () => {
  const d = createSeedData()
  it('an empty date range returns zeros, not NaN or errors', () => {
    const r = buildReport(d, f({ range: 'custom', from: '2000-01-01', to: '2000-01-31' }))
    expect(r.kpis.bookings.current).toBe(0)
    expect(r.kpis.gross.current).toBe(0)
    expect(r.bookingStatus).toEqual([])
    expect(r.awbRows).toEqual([])
    expect(r.kpis.awbs.pct).toBeNull()
    expect(r.kpis.bookings.awbConversionPct).toBeNull()
    for (const p of r.series) expect(Number.isFinite(p.revenue + p.bookings)).toBe(true)
    expect(r.kpis.awaitingPayment.count).toBeGreaterThan(0) // positions are not date-filtered
  })
  it('an empty data set builds an empty report', () => {
    const empty: AppData = { ...d, applications: [], bookings: [], refunds: [], audit: [], paymentExceptions: [], refundReversals: [] }
    const r = buildReport(empty, ALL)
    expect(r.series).toEqual([])
    expect(r.kpis.gross.current).toBe(0)
    expect(r.priority.customersApproved).toEqual({ priority: 0, nonPriority: 0, unclassified: 0 })
  })
  it('missing optional data is handled: no frozen price → not revenue; no payment date → last update time; unknown customer → no district', () => {
    const paidNoApproval = setBooking(d, 'bk-0418', { payment: { status: 'paid' } }) // pending HoC review, never approved
    expect(buildReport(paidNoApproval, ALL).paymentRows.some((p) => p.bookingId === 'bk-0418')).toBe(false)
    const target = d.bookings.find((b) => b.id === 'bk-0377')!
    const noDate = setBooking(d, target.id, { payment: { status: 'paid' } })
    expect(buildReport(noDate, ALL).paymentRows.find((p) => p.bookingId === target.id)!.paidAt).toBe(target.updatedAt)
    expect(buildReport(noDate, ALL).notes.some((n) => n.includes('no payment date'))).toBe(true)
    const orphan = { ...d, customers: d.customers.filter((c) => c.id !== target.customerId) }
    expect(buildReport(orphan, ALL).bookingRows.find((r) => r.id === target.id)!.district).toBe('—')
    expect(buildReport(orphan, f({ district: 'Lagos' })).bookingRows.some((r) => r.id === target.id)).toBe(false)
  })
  it('states its limitations instead of inventing data', () => {
    const notes = buildReport(d, ALL).notes.join(' ')
    expect(notes).toContain('payment channel')
    expect(notes).toContain('never counted as revenue')
    expect(notes).toContain('open-ended')
  })
})

describe('Managing Director home', () => {
  it('has no separate Dashboard item: Reports & Analytics is the home; everyone else keeps Dashboard', () => {
    for (const p of personas) {
      const hasDashboard = navForPersona(p).some((i) => i.path === '/dashboard')
      expect(hasDashboard).toBe(p.role !== 'managing_director')
    }
    expect(navForPersona(personas.find((p) => p.role === 'managing_director')!).some((i) => i.path === '/reports')).toBe(true)
  })
})

describe('access to Reports', () => {
  const roles: Role[] = ['cargo_facilitator', 'district_supervisor', 'head_of_cargo', 'director_operations', 'head_port_operations', 'super_admin', 'managing_director']
  it('only the Director, Super Admin and Managing Director have the reports area', () => {
    for (const role of roles) expect(canAccess(role, 'reports')).toBe(role === 'director_operations' || role === 'super_admin' || role === 'managing_director')
  })
  it('every demo persona (including the applicant) is checked, and only Director / Super Admin / MD see the nav item', () => {
    for (const p of personas) {
      const allowed = p.role === 'director_operations' || p.role === 'super_admin' || p.role === 'managing_director'
      expect(canAccessPersona(p, 'reports')).toBe(allowed)
      expect(navForPersona(p).some((i) => i.path === '/reports')).toBe(allowed)
    }
  })
  it('the route is wired through the same guard (direct URL access is blocked for other roles)', () => {
    expect(appSource).toContain("path=\"reports\" element={guarded('reports', <ReportsPage />)}")
    expect(guardSource).toContain('canAccessPersona(persona, area)')
  })
  it('other roles keep exactly their previous areas', () => {
    expect(canAccess('district_supervisor', 'registrations')).toBe(true)
    expect(canAccess('head_port_operations', 'dispatch')).toBe(true)
    expect(canAccess('cargo_facilitator', 'audit')).toBe(false)
    expect(canAccess('head_of_cargo', 'payments')).toBe(false)
  })
})
