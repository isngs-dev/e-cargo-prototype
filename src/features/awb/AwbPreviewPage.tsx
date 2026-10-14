import { Link, useParams } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Printer, TriangleAlert } from 'lucide-react'
import { useStore } from '@/app/store'
import { containerSummary, customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { Notice } from '@/components/ui/blocks'
import { Badge, Button } from '@/components/ui/primitives'
import { formatDate, formatDateTime } from '@/lib/format'
import { paymentStatusMeta } from '@/lib/status'

/** AWB preview. The QR encodes a clearly labelled DEMO reference — not a signed production verification URL. */
export function AwbPreviewPage() {
  const { id } = useParams()
  const { data, persona } = useStore()
  const booking = data.bookings.find((b) => b.id === id)
  const allowed = booking && visibleBookings(data, persona).some((b) => b.id === booking.id)

  if (!booking || !allowed || !booking.awb || !booking.dispatch) {
    return <Notice tone="warning" title="AWB not available">This booking has no AWB yet, or it is not visible to your role. <Link to="/awbs" className="underline">Back to AWBs</Link></Notice>
  }
  const { awb, dispatch } = booking
  const customer = data.customers.find((c) => c.id === booking.customerId)

  const rows: [string, string][] = [
    ['Booking reference', booking.reference],
    ['Route', routeLabel(data, booking.routeId)],
    [booking.cargoType === 'Containerized' ? 'Containers' : 'Wagons', containerSummary(booking)],
    ['Cargo', `${booking.commodity} · ${booking.weightTons} t${booking.hazardous ? ' · HAZARDOUS' : ''}`],
    ['Customer', customerName(data, booking.customerId)],
    ['Contact', customer ? `${customer.poc.name} · ${customer.poc.countryCode} ${customer.poc.phone}` : '—'],
    ['Payment status', paymentStatusMeta[booking.payment.status].label],
    ['Train number', dispatch.trainNumber],
    ['Wagon number', dispatch.wagonNumber],
    ['Departure', `${formatDate(dispatch.departureDate)} at ${dispatch.departureTime}`],
    ['Loading yard', dispatch.loadingYard ?? '—'],
    ['Generated', formatDateTime(awb.generatedAt)],
  ]

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link to={`/bookings/${booking.id}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> {booking.reference}</Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
      </div>

      <article className="mx-auto max-w-3xl overflow-hidden rounded-lg border-2 border-slate-800 bg-white" aria-label={`AWB ${awb.number}`}>
        <div className="flex items-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900">
          <TriangleAlert className="size-3.5" /> DEMONSTRATION DOCUMENT — not valid for transport. The QR is a demo reference, not a signed verification.
        </div>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Nigerian Railway Corporation · e-Cargo</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Air Waybill (AWB)</h1>
            <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-brand-800">{awb.number}</p>
            <div className="mt-2 flex gap-2"><Badge tone="success">Version {awb.version}</Badge><Badge>Demo data</Badge></div>
          </div>
          <div className="text-center">
            <QRCodeSVG value={awb.verificationRef} size={112} level="M" title={`Demo verification reference for ${awb.number}`} />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Demo verification</p>
          </div>
        </header>
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="border-b border-slate-100 pb-2"><dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>
          ))}
        </dl>
        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <p className="break-all">Reference encoded in QR: <span className="font-mono">{awb.verificationRef}</span></p>
          <p className="mt-1">Distributed to: customer, Head of Cargo, Director of Operations, Head of Port Operations (emails simulated). AWB numbers are never reused or edited.</p>
        </footer>
      </article>
    </>
  )
}
