import {
  DISTRICTS,
  type AppData,
  type Booking,
  type BookingStatus,
  type District,
  type ISODate,
  type Kobo,
  type PaymentStatus,
  type RegistrationApplication,
  type RegistrationStatus,
} from '@/types/domain'
import { formatKobo } from '@/lib/money'
import { bookingStatusMeta, PENDING_APPROVAL, registrationStatusMeta, type Tone } from '@/lib/status'

/**
 * Executive reporting: pure aggregation over AppData. No component calculates a figure itself.
 *
 * Definitions (see docs/DECISIONS.md A-50 … A-56):
 *  - Revenue RECEIVED = bookings whose payment is `paid` or `credit_settled`, at the Director-frozen total, dated by `payment.paidAt`.
 *    Indicative prices, approved-but-unpaid bookings and outstanding credit are never revenue.
 *  - Refunds = processed refunds that have not been reversed, dated by `processedAt`. Net received = gross received − refunds.
 *  - Unpaid and credit exposure are point-in-time positions (as at the latest data), not date-filtered.
 *  - District always comes from the customer / registration record — never from the route.
 */

// ---------------------------------------------------------------- filters

export type RangePreset = 'today' | 'last_7' | 'last_30' | 'this_month' | 'this_quarter' | 'custom' | 'all'

export interface ReportFilters {
  range: RangePreset
  /** Custom range bounds (inclusive, Lagos calendar days). Either may be empty. */
  from: ISODate | ''
  to: ISODate | ''
  district: District | 'all'
  bookingStatus: BookingStatus | 'all'
  paymentStatus: PaymentStatus | 'all'
  routeId: string | 'all'
}

export const DEFAULT_FILTERS: ReportFilters = { range: 'last_30', from: '', to: '', district: 'all', bookingStatus: 'all', paymentStatus: 'all', routeId: 'all' }

export const rangePresetLabels: Record<RangePreset, string> = {
  today: 'Today', last_7: 'Last 7 days', last_30: 'Last 30 days', this_month: 'This month', this_quarter: 'This quarter', custom: 'Custom range', all: 'All time',
}

export function isDefaultFilters(f: ReportFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof ReportFilters)[]).every((k) => f[k] === DEFAULT_FILTERS[k])
}

// ---------------------------------------------------------------- dates (Lagos, UTC+1, no DST)

const WAT_MS = 3_600_000
const DAY_MS = 86_400_000

/** Calendar day (Lagos time) of an ISO timestamp. */
export const dayKey = (iso: string): ISODate => new Date(Date.parse(iso) + WAT_MS).toISOString().slice(0, 10)

export const addDays = (date: ISODate, n: number): ISODate => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10)

const dayStartMs = (date: ISODate) => Date.parse(`${date}T00:00:00+01:00`)
const dayEndMs = (date: ISODate) => dayStartMs(addDays(date, 1)) - 1
const daysBetween = (a: ISODate, b: ISODate) => Math.round((dayStartMs(b) - dayStartMs(a)) / DAY_MS)

export interface DateWindow { fromDate: ISODate | null; toDate: ISODate | null }

export interface ResolvedRange extends DateWindow {
  label: string
  /** Equal-length window immediately before this one. Null when the range is open-ended (no honest comparison exists). */
  previous: DateWindow | null
}

/** Periods are measured back from the latest activity in the data, so the demo never shows an empty "last 7 days". */
export function latestActivity(data: AppData): string {
  const stamps: string[] = []
  for (const a of data.applications) stamps.push(a.submittedAt, a.updatedAt)
  for (const b of data.bookings) stamps.push(b.createdAt, b.updatedAt)
  for (const b of data.bookings) if (b.payment.paidAt) stamps.push(b.payment.paidAt)
  for (const b of data.bookings) if (b.awb) stamps.push(b.awb.generatedAt)
  for (const r of data.refunds) stamps.push(r.createdAt, ...(r.processedAt ? [r.processedAt] : []))
  for (const e of data.audit) stamps.push(e.at)
  const valid = stamps.filter((s) => !Number.isNaN(Date.parse(s)))
  if (!valid.length) return new Date().toISOString()
  return valid.reduce((max, s) => (Date.parse(s) > Date.parse(max) ? s : max))
}

export function resolveRange(f: ReportFilters, asOf: string): ResolvedRange {
  const today = dayKey(asOf)
  let fromDate: ISODate | null = null
  let toDate: ISODate | null = today
  switch (f.range) {
    case 'today': fromDate = today; break
    case 'last_7': fromDate = addDays(today, -6); break
    case 'last_30': fromDate = addDays(today, -29); break
    case 'this_month': fromDate = `${today.slice(0, 8)}01`; break
    case 'this_quarter': fromDate = `${today.slice(0, 4)}-${String(Math.floor((+today.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`; break
    case 'custom': {
      fromDate = f.from || null
      toDate = f.to || null
      if (fromDate && toDate && fromDate > toDate) [fromDate, toDate] = [toDate, fromDate]
      break
    }
    case 'all': fromDate = null; toDate = null; break
  }
  let previous: DateWindow | null = null
  if (fromDate && toDate) {
    const n = daysBetween(fromDate, toDate) + 1
    previous = { fromDate: addDays(fromDate, -n), toDate: addDays(fromDate, -1) }
  }
  return { fromDate, toDate, label: rangePresetLabels[f.range], previous }
}

export function inWindow(iso: string | undefined, w: DateWindow): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  if (w.fromDate && t < dayStartMs(w.fromDate)) return false
  if (w.toDate && t > dayEndMs(w.toDate)) return false
  return true
}

// ---------------------------------------------------------------- facts

export const APPROVED_BOOKING_STATUSES: BookingStatus[] = ['awaiting_payment', 'credit_approved', 'pending_dispatch', 'awb_generated', 'completed']
/** Registrations waiting on NRC staff; "sent back to facilitator" waits on the applicant instead. */
export const REGISTRATION_PENDING: RegistrationStatus[] = ['pending_district_verification', 'pending_director_approval', 'sent_back_to_district']

export interface BookingFact {
  b: Booking
  district: District | undefined
  customerName: string
  routeLabel: string
  isPriority: boolean
  /** Frozen approved total when available, otherwise the indicative total. */
  amount: Kobo
  frozen: boolean
}

export const isReceived = (b: Booking): boolean => !!b.approved && (b.payment.status === 'paid' || b.payment.status === 'credit_settled')
export const receivedAt = (b: Booking): string => b.payment.paidAt ?? b.updatedAt
export const firstAwbAt = (b: Booking): string | undefined => b.awbHistory?.[0]?.generatedAt ?? b.awb?.generatedAt

function factsFor(data: AppData, f: ReportFilters): BookingFact[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]))
  const routes = new Map(data.routes.map((r) => [r.id, r]))
  const out: BookingFact[] = []
  for (const b of data.bookings) {
    if (b.status === 'draft') continue
    const c = customers.get(b.customerId)
    const district = c?.district
    if (f.district !== 'all' && district !== f.district) continue
    if (f.routeId !== 'all' && b.routeId !== f.routeId) continue
    if (f.bookingStatus !== 'all' && b.status !== f.bookingStatus) continue
    if (f.paymentStatus !== 'all' && b.payment.status !== f.paymentStatus) continue
    const r = routes.get(b.routeId)
    out.push({
      b, district, customerName: c?.companyName ?? 'Unknown customer', routeLabel: r ? `${r.origin} → ${r.destination}` : 'Unknown route',
      isPriority: (b.approved?.eligibilitySnapshot ?? c?.eligibility)?.isPriority ?? false,
      amount: b.approved ? b.approved.price.totalPayable : b.indicativePrice.totalPayable, frozen: !!b.approved,
    })
  }
  return out
}

interface RefundFact { refundId: string; bookingId: string; amount: Kobo; at: string; fact: BookingFact }

function refundsFor(data: AppData, facts: BookingFact[]): RefundFact[] {
  const byBooking = new Map(facts.map((x) => [x.b.id, x]))
  const reversed = new Set(data.refundReversals.map((r) => r.refundId))
  const out: RefundFact[] = []
  for (const r of data.refunds) {
    if (r.status !== 'processed' || reversed.has(r.id)) continue
    const fact = byBooking.get(r.bookingId)
    if (!fact) continue
    out.push({ refundId: r.id, bookingId: r.bookingId, amount: r.amount, at: r.processedAt ?? r.createdAt, fact })
  }
  return out
}

interface Selection {
  registrations: RegistrationApplication[]
  bookings: BookingFact[]
  awbs: BookingFact[]
  payments: BookingFact[]
  refunds: RefundFact[]
}

function select(data: AppData, f: ReportFilters, facts: BookingFact[], allRefunds: RefundFact[], w: DateWindow): Selection {
  return {
    registrations: data.applications.filter((a) => (f.district === 'all' || a.district === f.district) && inWindow(a.submittedAt, w)),
    bookings: facts.filter((x) => inWindow(x.b.createdAt, w)),
    awbs: facts.filter((x) => !!x.b.awb && inWindow(firstAwbAt(x.b), w)),
    payments: facts.filter((x) => isReceived(x.b) && inWindow(receivedAt(x.b), w)),
    refunds: allRefunds.filter((r) => inWindow(r.at, w)),
  }
}

const sum = (xs: Kobo[]) => xs.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------- model

export interface Delta { current: number; previous: number | null; pct: number | null }

export function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const delta = (current: number, previous: number | null): Delta => ({ current, previous, pct: pctChange(current, previous) })

export type BucketUnit = 'day' | 'week' | 'month'

export interface SeriesPoint { key: ISODate; label: string; awbs: number; registrations: number; bookings: number; revenue: Kobo; refunds: Kobo }

export interface StatusSlice { key: string; label: string; tone: Tone; count: number }

export interface ReportModel {
  asOf: string
  range: ResolvedRange
  comparable: boolean
  kpis: {
    awbs: Delta
    registrations: Delta & { pending: number; awaitingApplicant: number; approved: number; rejected: number }
    bookings: Delta & { pending: number; approvedOrCompleted: number; completed: number; awbConversionPct: number | null }
    gross: Delta
    refunds: Delta
    net: Delta
    /** Point-in-time positions (not date-filtered). */
    awaitingPayment: { count: number; amount: Kobo }
    creditExposure: { count: number; amount: Kobo }
  }
  unit: BucketUnit
  series: SeriesPoint[]
  byDistrict: { district: District; registrations: number; bookings: number; awbs: number; revenue: Kobo; refunds: Kobo }[]
  byRoute: { routeId: string; label: string; bookings: number; awbs: number; revenue: Kobo }[]
  bookingStatus: StatusSlice[]
  registrationStatus: StatusSlice[]
  priority: {
    customersApproved: { priority: number; nonPriority: number; unclassified: number }
    bookings: { priority: number; nonPriority: number }
    revenue: { priority: Kobo; nonPriority: Kobo }
  }
  paymentSummary: { paid: number; unpaid: number; credit: number; cancelled: number; notDue: number }
  revenueByTerms: { payNow: Kobo; credit: Kobo }
  awbRows: AwbRow[]
  registrationRows: RegistrationRow[]
  bookingRows: BookingRow[]
  paymentRows: PaymentRow[]
  notes: string[]
}

export interface AwbRow { bookingId: string; awbNumber: string; version: number; reference: string; district: string; route: string; generatedAt: string; status: BookingStatus }
export interface RegistrationRow { id: string; reference: string; company: string; district: District; submittedAt: string; status: RegistrationStatus; stage: string }
export interface BookingRow { id: string; reference: string; customer: string; district: string; route: string; bookingDate: string; amount: Kobo; frozen: boolean; paymentStatus: PaymentStatus; status: BookingStatus; priority: boolean }
export interface PaymentRow { bookingId: string; reference: string; district: string; customer: string; paidAt: string; amount: Kobo; paymentStatus: PaymentStatus; terms: string; refund: 'None' | 'In progress' | 'Processed' | 'Reversed'; refundAmount: Kobo }

export function registrationStage(status: RegistrationStatus): string {
  switch (status) {
    case 'pending_district_verification': case 'sent_back_to_district': return 'District Supervisor'
    case 'pending_director_approval': return 'Director'
    case 'sent_back_to_facilitator': return 'Applicant'
    default: return 'Closed'
  }
}

function bucketStart(date: ISODate, unit: BucketUnit): ISODate {
  if (unit === 'day') return date
  if (unit === 'month') return `${date.slice(0, 8)}01`
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  return addDays(date, -dow)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function bucketLabel(key: ISODate, unit: BucketUnit): string {
  const day = `${+key.slice(8, 10)} ${MONTHS[+key.slice(5, 7) - 1]}`
  return unit === 'month' ? `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}` : unit === 'week' ? `w/c ${day}` : day
}

function statusSlices<S extends string>(order: S[], counts: Map<S, number>, meta: Record<S, { label: string; tone: Tone }>): StatusSlice[] {
  return order.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({ key: s, label: meta[s].label, tone: meta[s].tone, count: counts.get(s)! }))
}

export function buildReport(data: AppData, f: ReportFilters, asOf: string = latestActivity(data)): ReportModel {
  const range = resolveRange(f, asOf)
  const facts = factsFor(data, f)
  const allRefunds = refundsFor(data, facts)
  const cur = select(data, f, facts, allRefunds, range)
  const prev = range.previous ? select(data, f, facts, allRefunds, range.previous) : null

  const gross = sum(cur.payments.map((x) => x.amount))
  const refundTotal = sum(cur.refunds.map((r) => r.amount))
  const prevGross = prev ? sum(prev.payments.map((x) => x.amount)) : null
  const prevRefund = prev ? sum(prev.refunds.map((r) => r.amount)) : null

  const regCount = (s: Selection, st: RegistrationStatus[]) => s.registrations.filter((a) => st.includes(a.status)).length
  const bkCount = (s: Selection, st: BookingStatus[]) => s.bookings.filter((x) => st.includes(x.b.status)).length

  // point-in-time positions
  const awaiting = facts.filter((x) => x.b.status === 'awaiting_payment' && !!x.b.approved)
  const credit = facts.filter((x) => x.b.payment.status === 'credit_outstanding' && !!x.b.approved)

  // series
  const eventDates: ISODate[] = [
    ...cur.registrations.map((a) => dayKey(a.submittedAt)), ...cur.bookings.map((x) => dayKey(x.b.createdAt)),
    ...cur.awbs.map((x) => dayKey(firstAwbAt(x.b)!)), ...cur.payments.map((x) => dayKey(receivedAt(x.b))), ...cur.refunds.map((r) => dayKey(r.at)),
  ]
  const start = range.fromDate ?? (eventDates.length ? eventDates.reduce((m, d) => (d < m ? d : m)) : null)
  const end = range.toDate ?? dayKey(asOf)
  const spanDays = start ? daysBetween(start, end) + 1 : 0
  const unit: BucketUnit = spanDays <= 14 ? 'day' : spanDays <= 120 ? 'week' : 'month'
  const series: SeriesPoint[] = []
  if (start && spanDays > 0) {
    const index = new Map<ISODate, SeriesPoint>()
    for (let day = bucketStart(start, unit); day <= end; day = unit === 'day' ? addDays(day, 1) : unit === 'week' ? addDays(day, 7) : bucketStart(addDays(day, 32), 'month')) {
      const point: SeriesPoint = { key: day, label: bucketLabel(day, unit), awbs: 0, registrations: 0, bookings: 0, revenue: 0, refunds: 0 }
      index.set(day, point)
      series.push(point)
    }
    const at = (iso: string) => index.get(bucketStart(dayKey(iso), unit))
    for (const a of cur.registrations) { const p = at(a.submittedAt); if (p) p.registrations++ }
    for (const x of cur.bookings) { const p = at(x.b.createdAt); if (p) p.bookings++ }
    for (const x of cur.awbs) { const p = at(firstAwbAt(x.b)!); if (p) p.awbs++ }
    for (const x of cur.payments) { const p = at(receivedAt(x.b)); if (p) p.revenue += x.amount }
    for (const r of cur.refunds) { const p = at(r.at); if (p) p.refunds += r.amount }
  }

  // breakdowns
  const byDistrict = DISTRICTS.map((district) => ({
    district,
    registrations: cur.registrations.filter((a) => a.district === district).length,
    bookings: cur.bookings.filter((x) => x.district === district).length,
    awbs: cur.awbs.filter((x) => x.district === district).length,
    revenue: sum(cur.payments.filter((x) => x.district === district).map((x) => x.amount)),
    refunds: sum(cur.refunds.filter((r) => r.fact.district === district).map((r) => r.amount)),
  }))
  const byRoute = data.routes
    .map((r) => ({
      routeId: r.id, label: `${r.origin} → ${r.destination}`,
      bookings: cur.bookings.filter((x) => x.b.routeId === r.id).length,
      awbs: cur.awbs.filter((x) => x.b.routeId === r.id).length,
      revenue: sum(cur.payments.filter((x) => x.b.routeId === r.id).map((x) => x.amount)),
    }))
    .filter((r) => r.bookings || r.awbs || r.revenue || f.routeId === r.routeId)

  const bCounts = new Map<BookingStatus, number>()
  for (const x of cur.bookings) bCounts.set(x.b.status, (bCounts.get(x.b.status) ?? 0) + 1)
  const rCounts = new Map<RegistrationStatus, number>()
  for (const a of cur.registrations) rCounts.set(a.status, (rCounts.get(a.status) ?? 0) + 1)

  const customers = new Map(data.customers.map((c) => [c.id, c]))
  const approvedRegs = cur.registrations.filter((a) => a.status === 'activated')
  const customersApproved = { priority: 0, nonPriority: 0, unclassified: 0 }
  for (const a of approvedRegs) {
    const c = a.customerId ? customers.get(a.customerId) : undefined
    if (!c) customersApproved.unclassified++
    else if (c.eligibility.isPriority) customersApproved.priority++
    else customersApproved.nonPriority++
  }

  const payGroup = { paid: 0, unpaid: 0, credit: 0, cancelled: 0, notDue: 0 }
  for (const x of cur.bookings) {
    const s = x.b.payment.status
    if (s === 'paid' || s === 'credit_settled') payGroup.paid++
    else if (s === 'pending' || s === 'processing' || s === 'failed') payGroup.unpaid++
    else if (s === 'credit_outstanding') payGroup.credit++
    else if (s === 'cancelled') payGroup.cancelled++
    else payGroup.notDue++
  }

  // records
  const refundByBooking = new Map<string, 'In progress' | 'Processed' | 'Reversed'>()
  const refundAmountByBooking = new Map<string, Kobo>()
  const reversed = new Set(data.refundReversals.map((r) => r.refundId))
  for (const r of data.refunds) {
    refundByBooking.set(r.bookingId, reversed.has(r.id) ? 'Reversed' : r.status === 'processed' ? 'Processed' : 'In progress')
    refundAmountByBooking.set(r.bookingId, r.amount)
  }
  const byDateDesc = <T,>(get: (x: T) => string) => (a: T, b: T) => Date.parse(get(b)) - Date.parse(get(a))

  const awbRows: AwbRow[] = cur.awbs.map((x) => ({
    bookingId: x.b.id, awbNumber: x.b.awb!.number, version: x.b.awb!.version, reference: x.b.reference, district: x.district ?? '—', route: x.routeLabel,
    generatedAt: firstAwbAt(x.b)!, status: x.b.status,
  })).sort(byDateDesc((r) => r.generatedAt))
  const registrationRows: RegistrationRow[] = cur.registrations.map((a) => ({
    id: a.id, reference: a.reference, company: a.companyName, district: a.district, submittedAt: a.submittedAt, status: a.status, stage: registrationStage(a.status),
  })).sort(byDateDesc((r) => r.submittedAt))
  const bookingRows: BookingRow[] = cur.bookings.map((x) => ({
    id: x.b.id, reference: x.b.reference, customer: x.customerName, district: x.district ?? '—', route: x.routeLabel, bookingDate: x.b.bookingDate,
    amount: x.amount, frozen: x.frozen, paymentStatus: x.b.payment.status, status: x.b.status, priority: x.isPriority,
  })).sort((a, b) => Date.parse(cur.bookings.find((x) => x.b.id === b.id)!.b.createdAt) - Date.parse(cur.bookings.find((x) => x.b.id === a.id)!.b.createdAt))
  const paymentRows: PaymentRow[] = cur.payments.map((x) => ({
    bookingId: x.b.id, reference: x.b.reference, district: x.district ?? '—', customer: x.customerName, paidAt: receivedAt(x.b), amount: x.amount,
    paymentStatus: x.b.payment.status, terms: x.b.approved!.paymentTerms === 'pay_now' ? 'Pay now' : 'After credit period',
    refund: (refundByBooking.get(x.b.id) ?? 'None') as PaymentRow['refund'], refundAmount: refundAmountByBooking.get(x.b.id) ?? 0,
  })).sort(byDateDesc((r) => r.paidAt))

  const notes = [
    'Revenue received counts only bookings whose simulated payment is Paid or Credit Settled, at the Director-frozen total, on the payment date. Indicative prices, approved-but-unpaid bookings and outstanding credit are never counted as revenue.',
    'Refunds are processed refunds that have not been reversed, on the date they were processed. Net received = gross received − refunds in the same period.',
    'Awaiting payment and credit exposure are positions as at the latest data. The date range does not apply to them.',
    'The payment channel (card, bank transfer) is not recorded by the prototype, so revenue is split by payment terms instead. Payments in the exception queue (unmatched or duplicate) are not revenue until matched to an invoice.',
    'Counts by date use: registrations → submission date, bookings → creation date, AWBs → first generation date (amendments do not add AWBs), revenue → payment date.',
    'Booking status, payment status and route filters apply to bookings, AWBs and revenue; registrations respond only to the date range and district.',
  ]
  if (!range.previous) notes.push('Comparison with the previous period is unavailable because the selected range is open-ended.')
  if (customersApproved.unclassified) notes.push(`${customersApproved.unclassified} approved registration(s) have no linked customer record and are shown as unclassified.`)
  const missingDate = data.bookings.filter((b) => isReceived(b) && !b.payment.paidAt).length
  if (missingDate) notes.push(`${missingDate} received payment(s) have no payment date; their last update time is used.`)

  const awbTotal = cur.awbs.length
  const bookingTotal = cur.bookings.length
  return {
    asOf, range, comparable: !!prev,
    kpis: {
      awbs: delta(awbTotal, prev ? prev.awbs.length : null),
      registrations: {
        ...delta(cur.registrations.length, prev ? prev.registrations.length : null),
        pending: regCount(cur, REGISTRATION_PENDING), awaitingApplicant: regCount(cur, ['sent_back_to_facilitator']), approved: regCount(cur, ['activated']), rejected: regCount(cur, ['rejected']),
      },
      bookings: {
        ...delta(bookingTotal, prev ? prev.bookings.length : null),
        pending: bkCount(cur, PENDING_APPROVAL), approvedOrCompleted: bkCount(cur, APPROVED_BOOKING_STATUSES), completed: bkCount(cur, ['completed']),
        awbConversionPct: bookingTotal ? Math.round((cur.bookings.filter((x) => !!x.b.awb).length / bookingTotal) * 1000) / 10 : null,
      },
      gross: delta(gross, prevGross),
      refunds: delta(refundTotal, prevRefund),
      net: delta(gross - refundTotal, prevGross === null || prevRefund === null ? null : prevGross - prevRefund),
      awaitingPayment: { count: awaiting.length, amount: sum(awaiting.map((x) => x.amount)) },
      creditExposure: { count: credit.length, amount: sum(credit.map((x) => x.amount)) },
    },
    unit, series, byDistrict, byRoute,
    bookingStatus: statusSlices(Object.keys(bookingStatusMeta) as BookingStatus[], bCounts, bookingStatusMeta),
    registrationStatus: statusSlices(Object.keys(registrationStatusMeta) as RegistrationStatus[], rCounts, registrationStatusMeta),
    priority: {
      customersApproved,
      bookings: { priority: cur.bookings.filter((x) => x.isPriority).length, nonPriority: cur.bookings.filter((x) => !x.isPriority).length },
      revenue: { priority: sum(cur.payments.filter((x) => x.isPriority).map((x) => x.amount)), nonPriority: sum(cur.payments.filter((x) => !x.isPriority).map((x) => x.amount)) },
    },
    paymentSummary: payGroup,
    revenueByTerms: {
      payNow: sum(cur.payments.filter((x) => x.b.approved!.paymentTerms === 'pay_now').map((x) => x.amount)),
      credit: sum(cur.payments.filter((x) => x.b.approved!.paymentTerms === 'pay_after_credit').map((x) => x.amount)),
    },
    awbRows, registrationRows, bookingRows, paymentRows, notes,
  }
}

// ---------------------------------------------------------------- written summary

export interface SummarySection { title: string; lines: string[] }

/** "up 33.3% on the previous period (6)" — only when an honest comparison exists, otherwise empty. */
function change(d: Delta, comparable: boolean, money = false): string {
  if (!comparable || d.previous === null) return ''
  const prev = money ? formatKobo(d.previous) : String(d.previous)
  if (d.pct === null) return d.previous === 0 && d.current === 0 ? '' : ` (previous period: ${prev})`
  if (d.pct === 0) return ` (unchanged from the previous period, ${prev})`
  return ` (${d.pct > 0 ? 'up' : 'down'} ${Math.abs(d.pct)}% on the previous period, ${prev})`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The report in words: what happened in the selected period, what money came in, what is still to collect, and what
 * needs attention. Every sentence comes from the figures in the model — nothing is estimated.
 */
export function summarize(m: ReportModel, scope: string): SummarySection[] {
  const k = m.kpis
  const c = m.comparable
  const money = (n: number) => formatKobo(n)
  const out: SummarySection[] = []

  const total = k.registrations.current + k.bookings.current + k.awbs.current + k.gross.current
  out.push({ title: 'At a glance', lines: [
    `Scope: ${scope}.`,
    total === 0
      ? 'There is no activity in this scope. Widen the period or clear a filter.'
      : `${plural(k.bookings.current, 'booking')} ${k.bookings.current === 1 ? 'was' : 'were'} created${change(k.bookings, c)}, ${plural(k.registrations.current, 'company', 'companies')} applied to register${change(k.registrations, c)} and ${plural(k.awbs.current, 'AWB')} ${k.awbs.current === 1 ? 'was' : 'were'} issued${change(k.awbs, c)}. ${money(k.gross.current)} was received${k.refunds.current ? `, ${money(k.refunds.current)} was refunded, leaving ${money(k.net.current)} net` : ''}.`,
  ] })

  const reg = k.registrations
  const prio = m.priority.customersApproved
  out.push({ title: 'Registrations', lines: reg.current === 0 ? ['No applications were submitted in this scope.'] : [
    `${plural(reg.current, 'application')} submitted${change(reg, c)}: ${reg.approved} approved, ${reg.pending} with NRC staff (district check or Director), ${reg.awaitingApplicant} with the applicant for corrections and ${reg.rejected} rejected.`,
    ...(prio.priority + prio.nonPriority > 0 ? [`Of the approved companies, ${prio.priority} ${prio.priority === 1 ? 'is' : 'are'} Priority and ${prio.nonPriority} Non-Priority.`] : []),
    ...(m.byDistrict.some((d) => d.registrations) ? [`By district: ${m.byDistrict.map((d) => `${d.district} ${d.registrations}`).join(', ')}.`] : []),
  ] })

  const pay = m.paymentSummary
  const bk = k.bookings
  out.push({ title: 'Bookings', lines: bk.current === 0 ? ['No bookings were created in this scope.'] : [
    `${plural(bk.current, 'booking')} created${change(bk, c)}: ${bk.pending} waiting for approval, ${bk.approvedOrCompleted} approved or completed (${bk.completed} completed).`,
    `Payments: ${pay.paid} paid, ${pay.unpaid} unpaid, ${pay.credit} on credit, ${pay.cancelled} cancelled, ${pay.notDue} not yet due.`,
    `${m.priority.bookings.priority} ${m.priority.bookings.priority === 1 ? 'booking is' : 'bookings are'} from Priority customers and ${m.priority.bookings.nonPriority} from Non-Priority customers.`,
    ...(bk.awbConversionPct !== null ? [`${bk.awbConversionPct}% of these bookings have already reached an AWB.`] : []),
    ...(m.byRoute.some((r) => r.bookings) ? [`Busiest route: ${[...m.byRoute].sort((a, b) => b.bookings - a.bookings)[0]!.label} (${[...m.byRoute].sort((a, b) => b.bookings - a.bookings)[0]!.bookings}).`] : []),
  ] })

  out.push({ title: 'Air Waybills', lines: k.awbs.current === 0 ? ['No AWBs were issued in this scope.'] : [
    `${plural(k.awbs.current, 'AWB')} issued${change(k.awbs, c)}. By district: ${m.byDistrict.map((d) => `${d.district} ${d.awbs}`).join(', ')}.`,
    'An amended AWB is the same AWB with a new version, so amendments are not counted again.',
  ] })

  out.push({ title: 'Revenue', lines: k.gross.current === 0 && k.refunds.current === 0 ? ['No payments were received in this scope.'] : [
    `${money(k.gross.current)} was received${change(k.gross, c, true)}. Refunds processed: ${money(k.refunds.current)}. Net received: ${money(k.net.current)}${change(k.net, c, true)}.`,
    `By payment terms: ${money(m.revenueByTerms.payNow)} from pay-now bookings and ${money(m.revenueByTerms.credit)} from credit bookings settled.`,
    `By district: ${m.byDistrict.map((d) => `${d.district} ${money(d.revenue)}`).join(', ')}.`,
    'Only paid and credit-settled bookings count as revenue; approved but unpaid bookings and outstanding credit never do.',
  ] })

  out.push({ title: 'Money still to collect', lines: [
    `${money(k.awaitingPayment.amount)} is awaiting payment across ${plural(k.awaitingPayment.count, 'booking')}.`,
    `${money(k.creditExposure.amount)} of approved credit is outstanding across ${plural(k.creditExposure.count, 'booking')}.`,
    'These are positions as at the latest data. The period does not apply to them, and they are not revenue.',
  ] })

  const attention: string[] = []
  if (reg.pending) attention.push(`${plural(reg.pending, 'registration')} waiting on NRC staff.`)
  if (reg.awaitingApplicant) attention.push(`${plural(reg.awaitingApplicant, 'application')} waiting for the applicant to correct and resubmit.`)
  if (bk.pending) attention.push(`${plural(bk.pending, 'booking')} waiting for approval or correction.`)
  if (pay.unpaid) attention.push(`${plural(pay.unpaid, 'booking')} with an unpaid or failed payment.`)
  if (k.creditExposure.count) attention.push(`${plural(k.creditExposure.count, 'credit booking')} with a balance still outstanding.`)
  out.push({ title: 'Needs attention', lines: attention.length ? attention : ['Nothing is waiting in this scope.'] })
  return out
}
