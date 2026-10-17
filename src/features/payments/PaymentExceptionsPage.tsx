import { newestFirst } from '@/app/selectors'
import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, CircleCheck } from 'lucide-react'
import { useStore } from '@/app/store'
import { EmptyState, Notice, PageHeader } from '@/components/ui/blocks'
import { Badge, Card } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import type { PaymentException } from '@/types/domain'

export const resolutionLabel = { matched: 'Matched to an invoice', duplicate_refund: 'Duplicate — refund started', returned: 'Returned to sender' } as const

/** Payment exception queue. Each exception is a card that opens its own page, where it is resolved. */
export function PaymentExceptionsPage() {
  const { data } = useStore()
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const open = newestFirst(data.paymentExceptions.filter((p) => !p.resolved), (p) => p.receivedAt)
  const done = newestFirst(data.paymentExceptions.filter((p) => p.resolved), (p) => p.resolution?.at ?? p.receivedAt)
  const shown = tab === 'open' ? open : done

  return (
    <>
      <PageHeader title="Payment exceptions" description="Unmatched or duplicate payments routed to Super Admin for reconciliation. Open one to resolve it." />
      <div className="mb-4"><Notice title="Simulated reconciliation">No gateway is contacted and no money moves. Matching a payment to an invoice, or starting a duplicate refund, only changes demo data.</Notice></div>

      <div role="tablist" aria-label="Exception status" className="mb-4 inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-sm">
        {([['open', `Open (${open.length})`], ['resolved', `Resolved (${done.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded px-3 py-1.5 font-medium ${tab === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title={tab === 'open' ? 'No open exceptions' : 'Nothing resolved yet'} icon={CircleCheck} /></Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => <li key={p.id}><ExceptionCard p={p} /></li>)}
        </ul>
      )}
    </>
  )
}

function ExceptionCard({ p }: { p: PaymentException }) {
  const { data } = useStore()
  const booking = p.bookingId ? data.bookings.find((b) => b.id === p.bookingId) : undefined
  return (
    <Link
      to={`/payments/${p.id}`}
      className="group flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-brand-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600"
      aria-label={`Open payment exception ${p.reference}`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900">{p.reference}</span>
          <span className="text-base font-semibold tabular-nums text-slate-900">{formatKobo(p.amount)}</span>
          {p.resolved ? <Badge tone="success">{p.resolution ? resolutionLabel[p.resolution.action] : 'Resolved'}</Badge> : <Badge tone="warning">Unresolved</Badge>}
        </p>
        <p className="mt-1 text-sm text-slate-600">{p.issue}</p>
        <p className="mt-0.5 text-xs text-slate-400">Received {formatDateTime(p.receivedAt)}{booking && <> · linked to {booking.reference}</>}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm text-slate-400 group-hover:text-brand-700"><span className="hidden sm:inline">{p.resolved ? 'View' : 'Resolve'}</span><ChevronRight className="size-4" aria-hidden /></span>
    </Link>
  )
}
