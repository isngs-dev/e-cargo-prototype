import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { EmptyState, Notice, PageHeader } from '@/components/ui/blocks'
import { Dialog } from '@/components/ui/dialog'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, Card } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { matchableBookings, resolvePaymentException, type Resolution } from '@/lib/workflow/paymentException'
import type { Actor } from '@/lib/workflow/result'
import type { PaymentException } from '@/types/domain'

const actionLabel = { matched: 'Matched to an invoice', duplicate_refund: 'Duplicate — refund started', returned: 'Returned to sender' } as const

export function PaymentExceptionsPage() {
  const { data, persona, act } = useStore()
  const [target, setTarget] = useState<PaymentException | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const actor: Actor = { name: persona.name, role: persona.role }
  const open = data.paymentExceptions.filter((p) => !p.resolved)
  const done = data.paymentExceptions.filter((p) => p.resolved)

  return (
    <>
      <PageHeader title="Payment exceptions" description="Unmatched or duplicate payments routed to Super Admin for reconciliation." />
      <div className="mb-4"><Notice title="Simulated reconciliation">No gateway is contacted and no money moves. Matching a payment to an invoice, or starting a duplicate refund, only changes demo data.</Notice></div>
      {flash && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <p>{flash}</p>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="text-emerald-700"><X className="size-4" /></button>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-900">Open ({open.length})</h2>
      {open.length === 0 ? <Card><EmptyState title="No open exceptions" icon={CircleCheck} /></Card> : (
        <div className="mb-6 space-y-3">
          {open.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-mono text-xs font-semibold">{p.reference}</span><span className="font-semibold tabular-nums">{formatKobo(p.amount)}</span><Badge tone="warning">Unresolved</Badge></p>
                <p className="mt-1 text-sm text-slate-600">{p.issue}</p>
                <p className="mt-0.5 text-xs text-slate-500">Received {formatDateTime(p.receivedAt)}{p.bookingId && <> · linked booking <Link className="underline" to={`/bookings/${p.bookingId}`}>{data.bookings.find((b) => b.id === p.bookingId)?.reference}</Link></>}</p>
              </div>
              <Button onClick={() => setTarget(p)}>Resolve</Button>
            </Card>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Resolved ({done.length})</h2>
          <div className="space-y-3">
            {done.map((p) => (
              <Card key={p.id} className="p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold">{p.reference}</span><span className="tabular-nums">{formatKobo(p.amount)}</span><Badge tone="success">{p.resolution ? actionLabel[p.resolution.action] : 'Resolved'}</Badge></p>
                {p.resolution && <p className="mt-1 text-xs text-slate-500">{p.resolution.byName} · {formatDateTime(p.resolution.at)} — “{p.resolution.note}”</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      <ResolveDialog
        px={target} candidates={target ? matchableBookings(data, target.amount) : []} canRefund={!!target?.bookingId} onClose={() => setTarget(null)}
        onSubmit={(resolution, note) => {
          const r = act((d) => resolvePaymentException(d, target!.id, resolution, note, actor))
          if (!r.ok) return r.error
          setFlash(`${target!.reference} resolved (simulated).`)
          return null
        }}
      />
    </>
  )
}

function ResolveDialog({ px, candidates, canRefund, onClose, onSubmit }: {
  px: PaymentException | null
  candidates: { id: string; reference: string }[]
  canRefund: boolean
  onClose: () => void
  onSubmit: (r: Resolution, note: string) => string | null
}) {
  const [choice, setChoice] = useState<'matched' | 'duplicate_refund' | 'returned'>('returned')
  const [bookingId, setBookingId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [seed, setSeed] = useState('')
  if (px && seed !== px.id) { setSeed(px.id); setChoice(canRefund ? 'duplicate_refund' : candidates.length ? 'matched' : 'returned'); setBookingId(candidates[0]?.id ?? ''); setNote(''); setError('') }
  if (!px && seed) setSeed('')

  const submit = () => {
    const res: Resolution = choice === 'matched' ? { action: 'matched', bookingId } : choice === 'duplicate_refund' ? { action: 'duplicate_refund' } : { action: 'returned' }
    const err = onSubmit(res, note)
    if (err) return setError(err)
    onClose()
  }
  const options: [typeof choice, string, boolean, string][] = [
    ['matched', 'Match to an open invoice', candidates.length > 0, candidates.length ? '' : `No open invoice is for exactly ${px ? formatKobo(px.amount) : ''}`],
    ['duplicate_refund', 'Duplicate payment — start the refund flow', canRefund, canRefund ? '' : 'Not linked to a booking'],
    ['returned', 'Return to sender', true, ''],
  ]
  return (
    <Dialog open={!!px} onClose={onClose} title={`Resolve ${px?.reference ?? ''}`} description="Simulated — no money moves." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Resolve</Button></>}>
      <div className="space-y-3">
        <div className="space-y-2">
          {options.map(([k, label, enabled, why]) => (
            <label key={k} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${choice === k ? 'border-brand-600 bg-brand-50' : 'border-slate-300'} ${enabled ? 'cursor-pointer' : 'opacity-50'}`}>
              <input type="radio" name="resolution" className="mt-0.5 accent-brand-600" disabled={!enabled} checked={choice === k} onChange={() => { setChoice(k); setError('') }} />
              <span>{label}{why && <span className="block text-xs text-slate-500">{why}</span>}</span>
            </label>
          ))}
        </div>
        {choice === 'matched' && candidates.length > 0 && (
          <Field label="Invoice">
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.reference}</option>)}
            </select>
          </Field>
        )}
        <Field label="Resolution note" required><Textarea value={note} onChange={(e) => { setNote(e.target.value); setError('') }} /></Field>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Dialog>
  )
}
