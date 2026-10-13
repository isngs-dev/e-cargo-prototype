import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, Eye, TriangleAlert, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { containerSummary, customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { BookingStatusBadge, Notice, PageHeader, PaymentStatusBadge } from '@/components/ui/blocks'
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { BookingStages } from '@/features/audit/Timeline'
import { DocumentPreview } from '@/features/registrations/DocumentPreview'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatBp, formatKobo } from '@/lib/money'
import { documentLabels } from '@/lib/registration'
import type { UploadedDocument } from '@/types/domain'
import { PriceBreakdown } from './PriceBreakdown'

export function BookingDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data, persona } = useStore()
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)
  const [preview, setPreview] = useState<UploadedDocument | null>(null)

  const booking = data.bookings.find((b) => b.id === id)
  const allowed = booking && visibleBookings(data, persona).some((b) => b.id === booking.id)
  const isFacilitator = persona.role === 'cargo_facilitator'

  if (!booking || !allowed) {
    return <Notice tone="warning" title="Booking not available">It does not exist, was removed by “Reset demo”, or is not visible to your role. <Link to="/bookings" className="underline">Back to bookings</Link></Notice>
  }

  const customer = data.customers.find((c) => c.id === booking.customerId)
  const showDiscount = !!(booking.approved ? booking.approved.eligibilitySnapshot.isPriority : customer?.eligibility.isPriority)
  const timeline = data.audit.filter((e) => e.entityType === 'booking' && e.entityId === booking.id && !e.internal).slice().reverse()
  const lastRemark = [...timeline].find((e) => e.remarks && (e.toStatus?.startsWith('sent_back') || e.toStatus?.startsWith('rejected')))

  const rows: [string, string][] = [
    ['Company', customerName(data, booking.customerId)],
    ['Booking date', formatDate(booking.bookingDate)],
    ['Cargo type', booking.cargoType],
    ['Route', routeLabel(data, booking.routeId)],
    [booking.cargoType === 'Containerized' ? 'Containers' : 'Wagons', containerSummary(booking)],
    ['Weight', `${booking.weightTons} t`],
    ['Commodity', booking.commodity],
    ['Special handling', booking.specialHandling ?? '—'],
    ['Remarks', booking.remarks ?? '—'],
    ['Created', formatDateTime(booking.createdAt)],
  ]

  return (
    <>
      <Link to="/bookings" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> {isFacilitator ? 'My bookings' : 'All bookings'}</Link>
      <PageHeader
        title={booking.reference}
        description={<span className="inline-flex flex-wrap items-center gap-2"><BookingStatusBadge status={booking.status} />{booking.hazardous && <Badge tone="warning"><TriangleAlert className="size-3" /> Hazardous</Badge>}<Badge>Demo data</Badge></span>}
      />
      {flash && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <p>{flash}</p>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="text-emerald-700"><X className="size-4" /></button>
        </div>
      )}

      <Card className="mb-6 p-5"><BookingStages status={booking.status} /></Card>
      {lastRemark?.remarks && <div className="mb-6"><Notice tone="warning" title={lastRemark.action}>{lastRemark.remarks}</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Booking details" />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>)}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Simulated uploads — previews show metadata only." />
            <ul className="divide-y divide-slate-100">
              {booking.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-900">{documentLabels[d.kind]}</span><span className="block truncate text-xs text-slate-500">{d.fileName} · {d.sizeKb} KB</span></span>
                  <Button size="sm" variant="secondary" onClick={() => setPreview(d)}><Eye className="size-3.5" /> View</Button>
                </li>
              ))}
            </ul>
          </Card>

          {(booking.dispatch || booking.awb) && (
            <Card>
              <CardHeader title="Dispatch & AWB" description="Read-only. Dispatch entry and AWB preview arrive in Phase 6." />
              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
                {booking.awb && <div><dt className="text-xs text-slate-500">AWB number (demo)</dt><dd className="font-mono font-medium">{booking.awb.number}</dd></div>}
                {booking.dispatch && ([['Train', booking.dispatch.trainNumber], ['Wagon', booking.dispatch.wagonNumber], ['Departure', `${formatDate(booking.dispatch.departureDate)} ${booking.dispatch.departureTime}`], ['Loading yard', booking.dispatch.loadingYard ?? '—']] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {booking.approved ? (
            <PriceBreakdown price={booking.approved.price} showDiscount={showDiscount} mode="frozen" />
          ) : (
            <PriceBreakdown price={booking.indicativePrice} showDiscount={showDiscount} mode="indicative" />
          )}

          <Card>
            <CardHeader title="Payment & credit" description="All outcomes are simulated." />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><PaymentStatusBadge status={booking.payment.status} /></dd></div>
              {booking.approved ? (
                <>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Terms</dt><dd className="font-medium">{booking.approved.paymentTerms === 'pay_now' ? 'Payment link now' : `After ${booking.approved.creditMonths}-month credit`}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Discount granted</dt><dd className="font-medium">{showDiscount ? formatBp(booking.approved.price.discountBp) : '—'}</dd></div>
                  {booking.payment.dueBy && <div className="flex justify-between gap-3"><dt className="text-slate-500">Due by</dt><dd className="font-medium">{formatDateTime(booking.payment.dueBy)}</dd></div>}
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Approved total</dt><dd className="font-medium tabular-nums">{formatKobo(booking.approved.price.totalPayable)}</dd></div>
                </>
              ) : <p className="text-xs text-slate-500">Terms are set by the Director at approval. Payment happens only after approval.</p>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Actor, time, status change and remarks" />
            <ActivityList entries={timeline} />
          </Card>
        </div>
      </div>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </>
  )
}
