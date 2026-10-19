import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BarChart3, Banknote, FileText, Package, QrCode, Scale, Users, Download, FileSearch, RotateCcw, Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { BookingStatusBadge, EmptyState, PageHeader, PaymentStatusBadge, RegistrationStatusBadge } from '@/components/ui/blocks'
import { Badge, Button, Card, CardHeader, Input, Select, Table, Td, Th } from '@/components/ui/primitives'
import { toCsv } from '@/lib/csv'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import {
  buildReport, DEFAULT_FILTERS, isDefaultFilters, rangePresetLabels, summarize, type RangePreset, type ReportFilters,
} from '@/lib/reports'
import { bookingStatusMeta, paymentStatusMeta } from '@/lib/status'
import { DISTRICTS } from '@/types/domain'
import { ManagementSections } from './ManagementSections'
import {
  compactNaira, ComparisonBars, DeltaChip, Donut, LineChart, ReportKpi, SERIES, SplitBar, toneColor,
} from './charts'

type Tab = 'awbs' | 'registrations' | 'bookings' | 'payments'

const RANGES: RangePreset[] = ['today', 'last_7', 'last_30', 'this_month', 'this_quarter', 'custom', 'all']
const PAGE = 15

function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{children}</span>
}

/** Reports & Analytics body — used by /reports and embedded in the Managing Director dashboard. */
export function ReportsView({ recordsExtra }: { recordsExtra?: ReactNode } = {}) {
  const { data } = useStore()
  const [section, setSection] = useState<'graphs' | 'summary'>('graphs')
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS)
  const [tab, setTab] = useState<Tab>('bookings')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const set = (patch: Partial<ReportFilters>) => { setFilters((f) => ({ ...f, ...patch })); setLimit(PAGE) }
  const clear = () => { setFilters(DEFAULT_FILTERS); setQuery(''); setLimit(PAGE) }

  const model = useMemo(() => buildReport(data, filters), [data, filters])
  const { kpis, range } = model
  const fmtMoney = (n: number) => formatKobo(n)

  const spanText = range.fromDate && range.toDate ? `${formatDate(range.fromDate)} – ${formatDate(range.toDate)}`
    : range.fromDate ? `from ${formatDate(range.fromDate)}` : range.toDate ? `until ${formatDate(range.toDate)}` : 'all dates'
  const routeName = data.routes.find((r) => r.id === filters.routeId)
  const scopeText = `${range.label}${range.fromDate || range.toDate ? ` (${spanText})` : ''}, ${filters.district === 'all' ? 'all districts' : `${filters.district} district`}${filters.routeId !== 'all' && routeName ? `, route ${routeName.origin} → ${routeName.destination}` : ''}${filters.bookingStatus !== 'all' ? `, booking status ${bookingStatusMeta[filters.bookingStatus].label}` : ''}${filters.paymentStatus !== 'all' ? `, payment status ${paymentStatusMeta[filters.paymentStatus].label}` : ''}`
  const summary = useMemo(() => summarize(model, scopeText), [model, scopeText])
  const receivables = kpis.awaitingPayment.amount + kpis.creditExposure.amount
  const totalRecords = model.awbRows.length + model.registrationRows.length + model.bookingRows.length + model.paymentRows.length

  const labels = model.series.map((p) => p.label)
  const activityHasData = model.series.some((p) => p.awbs || p.registrations || p.bookings)
  const revenueHasData = model.series.some((p) => p.revenue || p.refunds)

  // ---- records tab
  const q = query.trim().toLowerCase()
  const match = (...parts: (string | number)[]) => !q || parts.some((p) => String(p).toLowerCase().includes(q))
  const awbRows = model.awbRows.filter((r) => match(r.awbNumber, r.reference, r.district, r.route))
  const regRows = model.registrationRows.filter((r) => match(r.reference, r.company, r.district))
  const bookingRows = model.bookingRows.filter((r) => match(r.reference, r.customer, r.district, r.route))
  const paymentRows = model.paymentRows.filter((r) => match(r.reference, r.customer, r.district))
  const tabs: { id: Tab; label: string; total: number; shown: number }[] = [
    { id: 'bookings', label: 'Bookings', total: model.bookingRows.length, shown: bookingRows.length },
    { id: 'awbs', label: 'AWBs', total: model.awbRows.length, shown: awbRows.length },
    { id: 'registrations', label: 'Registrations', total: model.registrationRows.length, shown: regRows.length },
    { id: 'payments', label: 'Payments received', total: model.paymentRows.length, shown: paymentRows.length },
  ]
  const current = tabs.find((t) => t.id === tab)!

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    let header: string[] = []
    let rows: unknown[][] = []
    if (tab === 'awbs') { header = ['AWB number', 'Version', 'Booking', 'District', 'Route', 'First generated', 'Status']; rows = awbRows.map((r) => [r.awbNumber, r.version, r.reference, r.district, r.route, r.generatedAt, bookingStatusMeta[r.status].label]) }
    if (tab === 'registrations') { header = ['Reference', 'Company', 'District', 'Submitted', 'Status', 'Review stage']; rows = regRows.map((r) => [r.reference, r.company, r.district, r.submittedAt, r.status, r.stage]) }
    if (tab === 'bookings') { header = ['Reference', 'Customer', 'Priority', 'District', 'Route', 'Booking date', 'Amount (NGN)', 'Amount basis', 'Payment status', 'Status']; rows = bookingRows.map((r) => [r.reference, r.customer, r.priority ? 'Priority' : 'Non-Priority', r.district, r.route, r.bookingDate, (r.amount / 100).toFixed(2), r.frozen ? 'Frozen approved' : 'Indicative', paymentStatusMeta[r.paymentStatus].label, bookingStatusMeta[r.status].label]) }
    if (tab === 'payments') { header = ['Payment date', 'Booking', 'District', 'Customer', 'Amount received (NGN)', 'Terms', 'Payment status', 'Refund', 'Refund amount (NGN)']; rows = paymentRows.map((r) => [r.paidAt, r.reference, r.district, r.customer, (r.amount / 100).toFixed(2), r.terms, paymentStatusMeta[r.paymentStatus].label, r.refund, (r.refundAmount / 100).toFixed(2)]) }
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nrc-ecargo-demo-report-${tab}-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const bookingSlices = model.bookingStatus.map((s) => ({ key: s.key, label: s.label, value: s.count, color: toneColor[s.tone] }))
  const regSlices = model.registrationStatus.map((s) => ({ key: s.key, label: s.label, value: s.count, color: toneColor[s.tone] }))

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Operational performance, cargo movement, registrations and revenue."
        actions={
          <>
            <span className="self-center text-xs text-slate-500">Last updated {formatDateTime(model.asOf)}</span>
            <Button variant="secondary" size="sm" onClick={clear} disabled={isDefaultFilters(filters) && !query}><RotateCcw className="size-3.5" /> Clear filters</Button>
          </>
        }
      />

      {/* ------------------------------------------------ section switch: graphs open by default, KPIs and records beside it */}
      <div role="tablist" aria-label="Report section" className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
        {([['graphs', 'Graphs', BarChart3], ['summary', 'Summary', FileText]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium ${section === id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ global filters */}
      <Card className="mb-6">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <FilterField label="Period">
            <Select value={filters.range} onChange={(e) => set({ range: e.target.value as RangePreset })} aria-label="Period">
              {RANGES.map((r) => <option key={r} value={r}>{rangePresetLabels[r]}</option>)}
            </Select>
          </FilterField>
          {filters.range === 'custom' && (
            <>
              <FilterField label="From"><Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} aria-label="From date" /></FilterField>
              <FilterField label="To"><Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} aria-label="To date" /></FilterField>
            </>
          )}
          <FilterField label="District">
            <Select value={filters.district} onChange={(e) => set({ district: e.target.value as ReportFilters['district'] })} aria-label="District">
              <option value="all">All districts</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Booking status">
            <Select value={filters.bookingStatus} onChange={(e) => set({ bookingStatus: e.target.value as ReportFilters['bookingStatus'] })} aria-label="Booking status">
              <option value="all">All statuses</option>
              {(Object.keys(bookingStatusMeta) as (keyof typeof bookingStatusMeta)[]).filter((s) => s !== 'draft').map((s) => <option key={s} value={s}>{bookingStatusMeta[s].label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Payment status">
            <Select value={filters.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value as ReportFilters['paymentStatus'] })} aria-label="Payment status">
              <option value="all">All payments</option>
              {(Object.keys(paymentStatusMeta) as (keyof typeof paymentStatusMeta)[]).map((s) => <option key={s} value={s}>{paymentStatusMeta[s].label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Route">
            <Select value={filters.routeId} onChange={(e) => set({ routeId: e.target.value })} aria-label="Route">
              <option value="all">All routes</option>
              {data.routes.map((r) => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
            </Select>
          </FilterField>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500" aria-live="polite">
          <span className="font-medium text-slate-600">Showing</span>
          <Chip>{range.label}: {spanText}</Chip>
          <Chip>{filters.district === 'all' ? 'All districts' : `${filters.district} district`}</Chip>
          {filters.bookingStatus !== 'all' && <Chip>Booking: {bookingStatusMeta[filters.bookingStatus].label}</Chip>}
          {filters.paymentStatus !== 'all' && <Chip>Payment: {paymentStatusMeta[filters.paymentStatus].label}</Chip>}
          {routeName && <Chip>Route: {routeName.origin} → {routeName.destination}</Chip>}
          <span className="ml-auto hidden text-slate-400 lg:inline">Booking status, payment status and route filters do not affect registrations.</span>
        </div>
      </Card>

      {totalRecords === 0 && kpis.awaitingPayment.count === 0 && kpis.creditExposure.count === 0 && (
        <Card className="mb-6">
          <EmptyState title="No records match these filters" description="Try a longer period or clear a filter. Figures are calculated only from records that exist in the demo data." icon={FileSearch}
            action={<Button variant="secondary" size="sm" onClick={clear}><RotateCcw className="size-3.5" /> Clear filters</Button>} />
        </Card>
      )}

      {section === 'graphs' && (
        <>
      {/* ------------------------------------------------ composition */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Booking status" description="Bookings created in the period" />
          <div className="p-5">
            {bookingSlices.length ? <Donut slices={bookingSlices} centreLabel="bookings" ariaLabel="Booking status distribution" /> : <EmptyState title="No bookings" />}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="font-medium tabular-nums">{model.paymentSummary.paid}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Unpaid</dt><dd className="font-medium tabular-nums">{model.paymentSummary.unpaid}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">On credit</dt><dd className="font-medium tabular-nums">{model.paymentSummary.credit}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Cancelled</dt><dd className="font-medium tabular-nums">{model.paymentSummary.cancelled}</dd></div>
            </dl>
          </div>
        </Card>
        <Card>
          <CardHeader title="Registration status" description="Applications submitted in the period" />
          <div className="p-5">
            {regSlices.length ? <Donut slices={regSlices} centreLabel="applications" ariaLabel="Registration status distribution" /> : <EmptyState title="No registrations" />}
          </div>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Priority vs Non-Priority" description="Customer status at approval" />
          <div className="space-y-5 p-5">
            <SplitBar label="Approved customers" a={model.priority.customersApproved.priority} b={model.priority.customersApproved.nonPriority} aLabel="Priority" bLabel="Non-Priority" />
            <SplitBar label="Bookings" a={model.priority.bookings.priority} b={model.priority.bookings.nonPriority} aLabel="Priority" bLabel="Non-Priority" />
            <SplitBar label="Revenue received" a={model.priority.revenue.priority} b={model.priority.revenue.nonPriority} aLabel="Priority" bLabel="Non-Priority" format={compactNaira} />
            {model.priority.customersApproved.unclassified > 0 && <p className="text-xs text-slate-500">{model.priority.customersApproved.unclassified} approved registration(s) have no linked customer record.</p>}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ trends */}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Activity over time" description={`AWBs, registrations and bookings · per ${model.unit}`} />
          <div className="p-4">
            {activityHasData ? (
              <LineChart labels={labels} integer format={(n) => String(n)} ariaLabel="Line chart of AWBs generated, registrations and bookings over time"
                series={[
                  { key: 'bookings', label: 'Bookings', color: SERIES.bookings, values: model.series.map((p) => p.bookings) },
                  { key: 'registrations', label: 'Registrations', color: SERIES.registrations, values: model.series.map((p) => p.registrations) },
                  { key: 'awbs', label: 'AWBs', color: SERIES.awbs, values: model.series.map((p) => p.awbs) },
                ]} />
            ) : <EmptyState title="No activity in this period" description="No AWBs, registrations or bookings fall in the selected period and filters." />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue over time" description={`Money received and refunded · per ${model.unit}`} />
          <div className="p-4">
            {revenueHasData ? (
              <LineChart labels={labels} format={fmtMoney} axisFormat={compactNaira} ariaLabel="Line chart of revenue received and refunds over time"
                series={[
                  { key: 'revenue', label: 'Revenue received', color: SERIES.revenue, values: model.series.map((p) => p.revenue) },
                  { key: 'refunds', label: 'Refunds processed', color: SERIES.refunds, values: model.series.map((p) => p.refunds) },
                ]} />
            ) : <EmptyState title="No payments received in this period" description="Unpaid bookings and outstanding credit are not revenue, so they never appear here." />}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ comparisons */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="By district" description="Customer / registration district" />
          <ComparisonBars
            rows={model.byDistrict.map((d) => ({ key: d.district, label: d.district, values: { reg: d.registrations, bk: d.bookings, awb: d.awbs, rev: d.revenue } }))}
            columns={[
              { key: 'reg', label: 'Registrations', color: SERIES.registrations, format: (n) => String(n) },
              { key: 'bk', label: 'Bookings', color: SERIES.bookings, format: (n) => String(n) },
              { key: 'awb', label: 'AWBs', color: SERIES.awbs, format: (n) => String(n) },
              { key: 'rev', label: 'Revenue', color: '#475569', format: compactNaira },
            ]} />
        </Card>
        <Card>
          <CardHeader title="By route" description="Bookings, AWBs and revenue" />
          {model.byRoute.length ? (
            <ComparisonBars
              rows={model.byRoute.map((r) => ({ key: r.routeId, label: r.label, values: { bk: r.bookings, awb: r.awbs, rev: r.revenue } }))}
              columns={[
                { key: 'bk', label: 'Bookings', color: SERIES.bookings, format: (n) => String(n) },
                { key: 'awb', label: 'AWBs', color: SERIES.awbs, format: (n) => String(n) },
                { key: 'rev', label: 'Revenue', color: '#475569', format: compactNaira },
              ]} />
          ) : <EmptyState title="No route activity" />}
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Revenue position" description="Received, refunded and still to collect" />
          <dl className="space-y-2 p-5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Gross received</dt><dd className="font-medium tabular-nums">{fmtMoney(kpis.gross.current)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Refunds processed</dt><dd className="font-medium tabular-nums text-red-700">−{fmtMoney(kpis.refunds.current)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-medium text-slate-900">Net received</dt><dd className="font-semibold tabular-nums">{fmtMoney(kpis.net.current)}</dd></div>
            <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">Received by payment terms</div>
            <div className="flex justify-between"><dt className="text-slate-600">Pay now</dt><dd className="tabular-nums">{fmtMoney(model.revenueByTerms.payNow)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Credit, settled</dt><dd className="tabular-nums">{fmtMoney(model.revenueByTerms.credit)}</dd></div>
            <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">Not yet received (not revenue)</div>
            <div className="flex justify-between"><dt className="text-slate-600">Awaiting payment ({kpis.awaitingPayment.count})</dt><dd className="tabular-nums">{fmtMoney(kpis.awaitingPayment.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Approved credit outstanding ({kpis.creditExposure.count})</dt><dd className="tabular-nums">{fmtMoney(kpis.creditExposure.amount)}</dd></div>
          </dl>
        </Card>
      </div>

        </>
      )}

      {section === 'summary' && (
        <>
          <details className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <summary className="cursor-pointer font-medium text-slate-900">Read this summary in words</summary>
            <div className="mt-3 space-y-4">
              {summary.map((sec) => (
                <div key={sec.title}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{sec.title}</p>
                  <div className="mt-1 space-y-1.5 leading-relaxed">{sec.lines.map((l, i) => <p key={i}>{l}</p>)}</div>
                </div>
              ))}
            </div>
          </details>

          {/* ---- KPI cards */}
          <div className="mb-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportKpi label="AWBs generated" value={kpis.awbs.current} icon={QrCode} tone="success"
              footer={<DeltaChip delta={kpis.awbs} comparable={model.comparable} />}>
              <span>{kpis.bookings.awbConversionPct === null ? 'No bookings in period' : `${kpis.bookings.awbConversionPct}% of bookings created in the period have an AWB`}</span>
            </ReportKpi>
            <ReportKpi label="Registrations" value={kpis.registrations.current} icon={Users} tone="accent"
              footer={<DeltaChip delta={kpis.registrations} comparable={model.comparable} />}>
              <span><strong className="text-slate-900">{kpis.registrations.pending}</strong> pending NRC</span>
              <span><strong className="text-slate-900">{kpis.registrations.approved}</strong> approved</span>
              <span><strong className="text-slate-900">{kpis.registrations.awaitingApplicant}</strong> with applicant</span>
              <span><strong className="text-slate-900">{kpis.registrations.rejected}</strong> rejected</span>
            </ReportKpi>
            <ReportKpi label="Bookings" value={kpis.bookings.current} icon={Package} tone="info"
              footer={<DeltaChip delta={kpis.bookings} comparable={model.comparable} />}>
              <span><strong className="text-slate-900">{kpis.bookings.pending}</strong> pending approval</span>
              <span><strong className="text-slate-900">{kpis.bookings.approvedOrCompleted}</strong> approved / completed</span>
              <span><strong className="text-slate-900">{kpis.bookings.completed}</strong> completed</span>
            </ReportKpi>
            <ReportKpi label="Revenue received" value={fmtMoney(kpis.gross.current)} icon={Banknote} tone="success"
              footer={<DeltaChip delta={kpis.gross} comparable={model.comparable} money />}>
              <span>Paid and credit-settled bookings only (simulated payments)</span>
            </ReportKpi>
            <ReportKpi label="Net revenue" value={fmtMoney(kpis.net.current)} icon={Scale} tone="neutral"
              footer={<DeltaChip delta={kpis.net} comparable={model.comparable} money />}>
              <span>Received {fmtMoney(kpis.gross.current)} − refunds {fmtMoney(kpis.refunds.current)}</span>
            </ReportKpi>
            <ReportKpi label="Receivables (not revenue)" value={fmtMoney(receivables)} icon={BarChart3} tone="warning"
              footer={<span className="text-slate-400">Position as at the latest data; the period does not apply</span>}>
              <span><strong className="text-slate-900">{fmtMoney(kpis.awaitingPayment.amount)}</strong> awaiting payment ({kpis.awaitingPayment.count})</span>
              <span><strong className="text-slate-900">{fmtMoney(kpis.creditExposure.amount)}</strong> approved credit outstanding ({kpis.creditExposure.count})</span>
            </ReportKpi>
          </div>

      {/* ------------------------------------------------ records */}
      <Card className="mb-6">
        <CardHeader title="Detailed records" description="The records behind the figures above. Open any reference for its full page."
          action={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={current.shown === 0}><Download className="size-3.5" /> Export CSV</Button>} />
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Record type" className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setLimit(PAGE) }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'text-slate-600 hover:bg-slate-100'}`}>
                {t.label} <span className="ml-1 text-xs tabular-nums text-slate-500">{t.total}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} placeholder="Search this table" className="pl-9" aria-label="Search records" />
          </div>
        </div>

        {current.shown === 0 ? (
          <EmptyState title={current.total ? 'No records match your search' : 'No records for these filters'} description={current.total ? undefined : 'Change the period or filters to see records here.'} />
        ) : (
          <Table>
            {tab === 'bookings' && (
              <>
                <thead><tr><Th>Booking</Th><Th>Customer</Th><Th>District</Th><Th>Route</Th><Th>Booking date</Th><Th className="text-right">Amount</Th><Th>Payment</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {bookingRows.slice(0, limit).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <Td><Link to={`/bookings/${r.id}`} className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline">{r.reference}</Link></Td>
                      <Td className="max-w-56"><span className="block truncate">{r.customer}</span><Badge tone={r.priority ? 'accent' : 'neutral'} className="mt-0.5">{r.priority ? 'Priority' : 'Non-Priority'}</Badge></Td>
                      <Td>{r.district}</Td>
                      <Td className="whitespace-nowrap">{r.route}</Td>
                      <Td className="whitespace-nowrap">{formatDate(r.bookingDate)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatKobo(r.amount)}<span className="block text-[11px] text-slate-400">{r.frozen ? 'Frozen' : 'Indicative'}</span></Td>
                      <Td><PaymentStatusBadge status={r.paymentStatus} /></Td>
                      <Td><BookingStatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === 'awbs' && (
              <>
                <thead><tr><Th>AWB number</Th><Th>Booking</Th><Th>District</Th><Th>Route</Th><Th>Generated</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {awbRows.slice(0, limit).map((r) => (
                    <tr key={r.bookingId} className="hover:bg-slate-50/60">
                      <Td><Link to={`/bookings/${r.bookingId}/awb`} className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline">{r.awbNumber}</Link>{r.version > 1 && <Badge tone="info" className="ml-2">v{r.version}</Badge>}</Td>
                      <Td><Link to={`/bookings/${r.bookingId}`} className="whitespace-nowrap font-mono text-xs hover:underline">{r.reference}</Link></Td>
                      <Td>{r.district}</Td>
                      <Td className="whitespace-nowrap">{r.route}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(r.generatedAt)}</Td>
                      <Td><BookingStatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === 'registrations' && (
              <>
                <thead><tr><Th>Application</Th><Th>Company</Th><Th>District</Th><Th>Submitted</Th><Th>Status</Th><Th>Review stage</Th></tr></thead>
                <tbody>
                  {regRows.slice(0, limit).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <Td><Link to={`/registrations/${r.id}`} className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline">{r.reference}</Link></Td>
                      <Td className="max-w-56 truncate">{r.company}</Td>
                      <Td>{r.district}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(r.submittedAt)}</Td>
                      <Td><RegistrationStatusBadge status={r.status} /></Td>
                      <Td>{r.stage}</Td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === 'payments' && (
              <>
                <thead><tr><Th>Payment date</Th><Th>Booking</Th><Th>District</Th><Th>Customer</Th><Th className="text-right">Amount received</Th><Th>Terms</Th><Th>Payment</Th><Th>Refund</Th></tr></thead>
                <tbody>
                  {paymentRows.slice(0, limit).map((r) => (
                    <tr key={r.bookingId} className="hover:bg-slate-50/60">
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(r.paidAt)}</Td>
                      <Td><Link to={`/bookings/${r.bookingId}`} className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline">{r.reference}</Link></Td>
                      <Td>{r.district}</Td>
                      <Td className="max-w-48 truncate">{r.customer}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatKobo(r.amount)}</Td>
                      <Td className="whitespace-nowrap">{r.terms}</Td>
                      <Td><PaymentStatusBadge status={r.paymentStatus} /></Td>
                      <Td className="whitespace-nowrap">{r.refund === 'None' ? <span className="text-slate-400">None</span> : <Badge tone={r.refund === 'Processed' ? 'danger' : 'warning'}>{r.refund} · {formatKobo(r.refundAmount)}</Badge>}</Td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-slate-500">
          <span>Showing {Math.min(limit, current.shown)} of {current.shown}{current.shown !== current.total ? ` (${current.total} before search)` : ''} · demonstration data</span>
          {current.shown > limit && <Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>Show more</Button>}
        </div>
      </Card>

          {recordsExtra}
          <details className="mb-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-900">How these figures are calculated, and what is not available</summary>
        <p className="mt-2 text-xs text-slate-500">Periods are measured back from the latest activity in the demo data ({formatDateTime(model.asOf)}).</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs">{model.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </details>
        </>
      )}
    </>
  )
}

export function ReportsPage() {
  const { persona } = useStore()
  return <ReportsView recordsExtra={persona.role === 'managing_director' ? <ManagementSections /> : null} />
}
