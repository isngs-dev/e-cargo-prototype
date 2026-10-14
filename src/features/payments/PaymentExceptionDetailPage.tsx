import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useStore } from '@/app/store'
import { Flash, Notice, PageHeader } from '@/components/ui/blocks'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, Card, CardHeader, Select } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { matchableBookings, resolvePaymentException, type Resolution } from '@/lib/workflow/paymentException'
import type { Actor } from '@/lib/workflow/result'
import { resolutionLabel } from './PaymentExceptionsPage'

type Choice = 'matched' | 'duplicate_refund' | 'returned'

/** One payment exception: what was received, and (Super Admin) how to resolve it. */
export function PaymentExceptionDetailPage() {
  const { id } = useParams()
  const { data, persona, act } = useStore()
  const px = data.paymentExceptions.find((p) => p.id === id)
  const candidates = px ? matchableBookings(data, px.amount) : []
  const canRefund = !!px?.bookingId
  const [choice, setChoice] = useState<Choice | null>(null)
  const [bookingId, setBookingId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  if (!px) return <Notice tone="warning" title="Payment exception not found">It may have been removed by “Reset demo”. <Link to="/payments" className="underline">Back to payment exceptions</Link></Notice>

  const isSA = persona.role === 'super_admin'
  const actor: Actor = { name: persona.name, role: persona.role }
  const booking = px.bookingId ? data.bookings.find((b) => b.id === px.bookingId) : undefined
  const effective: Choice = choice ?? (canRefund ? 'duplicate_refund' : candidates.length ? 'matched' : 'returned')
  const selected = bookingId || candidates[0]?.id || ''
  const history = data.audit.filter((e) => e.entityType === 'payment' && e.entityId === px.id).slice().reverse()

  const options: [Choice, string, boolean, string][] = [
    ['matched', 'Match to an open invoice', candidates.length > 0, candidates.length ? `Applies the payment to an open invoice for exactly ${formatKobo(px.amount)}.` : `No open invoice is for exactly ${formatKobo(px.amount)}.`],
    ['duplicate_refund', 'Duplicate payment — start the refund flow', canRefund, canRefund ? 'The Director triggers the refund; Super Admin processes it.' : 'Not linked to a booking.'],
    ['returned', 'Return to sender', true, 'Records that the payment is returned (simulated).'],
  ]

  const resolve = () => {
    const resolution: Resolution = effective === 'matched' ? { action: 'matched', bookingId: selected } : effective === 'duplicate_refund' ? { action: 'duplicate_refund' } : { action: 'returned' }
    const r = act((d) => resolvePaymentException(d, px.id, resolution, note, actor))
    if (!r.ok) return setError(r.error)
    setFlash(`${px.reference} resolved (simulated).`)
    setNote(''); setError('')
  }

  return (
    <>
      <Link to="/payments" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> All payment exceptions</Link>
      <PageHeader
        title={px.reference}
        description={<span className="inline-flex flex-wrap items-center gap-2"><span className="font-semibold tabular-nums text-slate-800">{formatKobo(px.amount)}</span>{px.resolved ? <Badge tone="success">{px.resolution ? resolutionLabel[px.resolution.action] : 'Resolved'}</Badge> : <Badge tone="warning">Unresolved</Badge>}</span>}
      />
      <Flash message={flash} onDismiss={() => setFlash(null)} />
      <Notice title="Simulated reconciliation">No gateway is contacted and no money moves.</Notice>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="What was received" />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Payment reference</dt><dd className="font-mono text-xs font-medium">{px.reference}</dd></div>
              <div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-medium tabular-nums">{formatKobo(px.amount)}</dd></div>
              <div><dt className="text-xs text-slate-500">Received</dt><dd className="font-medium">{formatDateTime(px.receivedAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Linked booking</dt><dd className="font-medium">{booking ? <Link to={`/bookings/${booking.id}`} className="font-mono text-brand-700 hover:underline">{booking.reference}</Link> : 'None'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Why it is an exception</dt><dd className="font-medium">{px.issue}</dd></div>
            </dl>
          </Card>

          {px.resolution && (
            <Card>
              <CardHeader title="Resolution" />
              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Outcome</dt><dd className="font-medium">{resolutionLabel[px.resolution.action]}</dd></div>
                <div><dt className="text-xs text-slate-500">By</dt><dd className="font-medium">{px.resolution.byName} · {formatDateTime(px.resolution.at)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Note</dt><dd className="font-medium">{px.resolution.note}</dd></div>
                {px.resolution.bookingId && <div><dt className="text-xs text-slate-500">Booking affected</dt><dd className="font-medium"><Link to={`/bookings/${px.resolution.bookingId}`} className="font-mono text-brand-700 hover:underline">{data.bookings.find((b) => b.id === px.resolution!.bookingId)?.reference}</Link></dd></div>}
              </dl>
            </Card>
          )}

          {!px.resolved && (
            isSA ? (
              <Card>
                <CardHeader title="Resolve this exception" description="Choose how the payment is dealt with, and record why." />
                <div className="space-y-4 p-5">
                  <div className="space-y-2">
                    {options.map(([k, label, enabled, why]) => (
                      <label key={k} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${effective === k ? 'border-brand-600 bg-brand-50' : 'border-slate-300'} ${enabled ? 'cursor-pointer' : 'opacity-50'}`}>
                        <input type="radio" name="resolution" className="mt-0.5 accent-brand-600" disabled={!enabled} checked={effective === k} onChange={() => { setChoice(k); setError('') }} />
                        <span>{label}<span className="block text-xs text-slate-500">{why}</span></span>
                      </label>
                    ))}
                  </div>
                  {effective === 'matched' && candidates.length > 0 && (
                    <Field label="Invoice">
                      <Select value={selected} onChange={(e) => setBookingId(e.target.value)}>{candidates.map((c) => <option key={c.id} value={c.id}>{c.reference}</option>)}</Select>
                    </Field>
                  )}
                  <Field label="Resolution note" required><Textarea value={note} onChange={(e) => { setNote(e.target.value); setError('') }} /></Field>
                  {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                  <Button onClick={resolve}>Resolve exception</Button>
                </div>
              </Card>
            ) : (
              <Notice title="Awaiting Super Admin">Only Super Admin resolves payment exceptions.</Notice>
            )
          )}
        </div>
        <Card><CardHeader title="History" description="Actor, time and outcome" /><ActivityList entries={history} /></Card>
      </div>
    </>
  )
}
