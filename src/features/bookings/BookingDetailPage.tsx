import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { returnsAfterDecision, returnTarget } from '@/app/returnTarget'
import { ArrowLeft, Eye, FilePen, TriangleAlert } from 'lucide-react'
import { useStore } from '@/app/store'
import { containerSummary, customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { BookingStatusBadge, Notice, PageHeader, PaymentStatusBadge, Flash } from '@/components/ui/blocks'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, buttonClass, Card, CardHeader } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { BookingStages } from '@/features/audit/Timeline'
import { ContainerPhotos } from './ContainerPhotos'
import { DocumentPreview } from '@/features/registrations/DocumentPreview'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatBp, formatKobo } from '@/lib/money'
import { documentLabels } from '@/lib/registration'
import type { UploadedDocument } from '@/types/domain'
import { addBookingRemark } from '@/lib/workflow/bookingApproval'
import type { Actor } from '@/lib/workflow/result'
import { DirectorPanel, HeadOfCargoPanel } from './ApprovalPanels'
import { DispatchPanel } from '@/features/dispatch/DispatchPanel'
import { AmendAwbPanel } from '@/features/dispatch/AmendAwbPanel'
import { completeBooking } from '@/lib/workflow/dispatch'
import { isReadyForDispatch } from '@/lib/status'
import { FacilitatorPaymentPanel, SuperAdminPaymentControls } from './PaymentPanels'
import { PriceBreakdown } from './PriceBreakdown'
import type { Run } from './runTypes'

export function BookingDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, persona, act } = useStore()
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)
  const [preview, setPreview] = useState<UploadedDocument | null>(null)

  const booking = data.bookings.find((b) => b.id === id)
  const allowed = booking && visibleBookings(data, persona).some((b) => b.id === booking.id)
  const isFacilitator = persona.role === 'cargo_facilitator'

  if (!booking || !allowed) {
    return <Notice tone="warning" title="Booking not available">It does not exist, was removed by “Reset demo”, or is not visible to your role. <Link to="/bookings" className="underline">Back to bookings</Link></Notice>
  }

  const customer = data.customers.find((c) => c.id === booking.customerId)
  const actor: Actor = { name: persona.name, role: persona.role, customerId: persona.customerId }
  const run: Run = (fn, success) => {
    const before = booking.status
    const r = act(fn)
    if (!r.ok) return r.error
    // A decision that moves the booking on (approve, forward, send back, reject, dispatch…) returns the officer to where they came from.
    if (returnsAfterDecision(persona.role) && r.data.bookings.find((b) => b.id === booking.id)?.status !== before) {
      navigate(returnTarget(persona.role), { state: { shellFlash: success } })
      return null
    }
    setFlash(success)
    return null
  }
  const isHoc = persona.role === 'head_of_cargo'
  const isDir = persona.role === 'director_operations'
  const isSA = persona.role === 'super_admin'
  const isHop = persona.role === 'head_port_operations'
  const hocOpen = booking.status === 'pending_hoc_review' || booking.status === 'sent_back_to_hoc'
  const dirOpen = booking.status === 'pending_director_review'
  const canAddPhotos = isHop && ['pending_dispatch', 'credit_approved', 'awb_generated'].includes(booking.status)
  const addNote = () => {
    const err = run((d) => addBookingRemark(d, booking.id, actor, note), 'Internal remark added (not visible to the facilitator).')
    if (err) return setNoteError(err)
    setNote('')
    setNoteError('')
  }
  const showDiscount = !!(booking.approved ? booking.approved.eligibilitySnapshot.isPriority : customer?.eligibility.isPriority)
  const timeline = data.audit.filter((e) => e.entityType === 'booking' && e.entityId === booking.id && !(isFacilitator && e.internal)).slice().reverse()
  const lastRemark = [...timeline].find((e) => e.remarks && (e.toStatus?.startsWith('sent_back') || e.toStatus?.startsWith('rejected')))

  const rows: [string, string][] = [
    ['Company', customerName(data, booking.customerId)],
    ['Customer status', showDiscount ? 'Priority customer' : 'Non-Priority customer'],
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
      <Flash message={flash} onDismiss={() => setFlash(null)} />

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

          {(((booking.photos?.length ?? 0) > 0) || canAddPhotos) && <ContainerPhotos booking={booking} actor={actor} run={run} canEdit={canAddPhotos} />}

          {(booking.dispatch || booking.awb) && (
            <Card>
              <CardHeader title="Dispatch & AWB" action={booking.awb ? <Link to={`/bookings/${booking.id}/awb`} className={buttonClass('primary', 'sm')}>View AWB</Link> : undefined} />
              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
                {booking.awb && <div><dt className="text-xs text-slate-500">AWB number (demo)</dt><dd className="font-mono font-medium">{booking.awb.number}</dd></div>}
                {booking.awb && <div><dt className="text-xs text-slate-500">Version</dt><dd className="font-medium">{booking.awb.version}{(booking.awbHistory?.length ?? 0) > 0 ? ` (${booking.awbHistory!.length} earlier superseded)` : ''}</dd></div>}
                {booking.awb && <div><dt className="text-xs text-slate-500">Generated</dt><dd className="font-medium">{formatDateTime(booking.awb.generatedAt)}</dd></div>}
                {booking.dispatch && ([['Train', booking.dispatch.trainNumber], ['Wagon', booking.dispatch.wagonNumber], ['Departure', `${formatDate(booking.dispatch.departureDate)} ${booking.dispatch.departureTime}`], ['Loading yard', booking.dispatch.loadingYard ?? '—']] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {isFacilitator && booking.status === 'sent_back_to_facilitator' && (
            <Card>
              <CardHeader title="Action required" description="Correct the issues noted above and resubmit." />
              <div className="p-5"><Link to={`/bookings/${booking.id}/edit`} className={buttonClass('primary', 'md', 'w-full')}><FilePen className="size-4" /> Correct & resubmit</Link></div>
            </Card>
          )}
          {isFacilitator && <FacilitatorPaymentPanel booking={booking} />}
          {isSA && <SuperAdminPaymentControls booking={booking} actor={actor} run={run} />}
          {isHop && isReadyForDispatch(booking) && <DispatchPanel booking={booking} actor={actor} run={run} />}
          {isHop && booking.status === 'awaiting_payment' && <Notice title="Held until payment clears">This booking is not released to the port until the customer's payment is confirmed.</Notice>}
          {isHop && booking.status === 'awb_generated' && booking.dispatch && <AmendAwbPanel key={booking.awb?.version} booking={booking} actor={actor} run={run} />}
          {isHop && booking.status === 'awb_generated' && (
            <Card>
              <CardHeader title="Delivery" description="Mark the booking completed once the consignment is delivered." />
              <div className="p-5"><Button className="w-full" onClick={() => run((d) => completeBooking(d, booking.id, actor), 'Booking marked completed.')}>Mark as delivered & complete</Button></div>
            </Card>
          )}
          {booking.status === 'rejected_physical' && (
            <Notice tone="warning" title="Physical verification failed">
              {data.refunds.some((r) => r.bookingId === booking.id) ? <>Payment had been received, so a refund was started. <Link to="/refunds" className="underline">Open Refunds</Link>.</> : 'No payment had been received, so no refund is required.'}
            </Notice>
          )}
          {isHoc && hocOpen && <HeadOfCargoPanel booking={booking} actor={actor} run={run} />}
          {isDir && dirOpen && customer && <DirectorPanel booking={booking} customer={customer} data={data} actor={actor} run={run} />}
          {isDir && hocOpen && <Notice title="With Head of Cargo">This booking reaches you once the Head of Cargo has verified it.</Notice>}
          {isSA && <Notice title="View only (approvals)">Super Admin cannot approve bookings, set discounts or payment terms. The controls above only stand in for system events.</Notice>}
          {(isHoc || isDir) && (
            <Card>
              <CardHeader title="Internal remark" description="Visible to NRC reviewers only." />
              <div className="space-y-2 p-5">
                <Field label="Remark" error={noteError}><Textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteError('') }} /></Field>
                <Button size="sm" variant="secondary" onClick={addNote}>Add remark</Button>
              </div>
            </Card>
          )}
          {/* The Director's decision panel already shows the live price preview, so no second price card while deciding. */}
          {!isHop && !(isDir && dirOpen) && (booking.approved ? (
            <PriceBreakdown price={booking.approved.price} showDiscount={showDiscount} mode="frozen" />
          ) : (
            <PriceBreakdown price={booking.indicativePrice} showDiscount={showDiscount} mode="indicative" />
          ))}

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
