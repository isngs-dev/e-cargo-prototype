import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Landmark } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName, ts } from '@/app/selectors'
import { EmptyState, Notice, PageHeader } from '@/components/ui/blocks'
import { Badge, Card, Select } from '@/components/ui/primitives'
import { StageTracker } from '@/features/audit/Timeline'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { refundSteps } from '@/lib/workflow/refund'
import type { RefundStatus } from '@/types/domain'
import { refundActionHint, refundTone } from './refundUi'

/** Refund list. Each refund is a card that opens its own page, where the actions are done. */
export function RefundsPage() {
  const { data, persona } = useStore()
  const [status, setStatus] = useState<RefundStatus | 'all' | 'mine'>('all')
  const isFac = persona.role === 'cargo_facilitator'
  const all = useMemo(
    () => [...data.refunds].filter((r) => (isFac ? r.customerId === persona.customerId : true)).sort((a, b) => ts(b.createdAt) - ts(a.createdAt)),
    [data.refunds, isFac, persona.customerId],
  )
  const mine = all.filter((r) => refundActionHint(persona.role, r.status))
  const shown = status === 'all' ? all : status === 'mine' ? mine : all.filter((r) => r.status === status)

  return (
    <>
      <PageHeader title="Refunds" description="Refund flow after a physical-verification failure on a paid booking. The Director triggers it; Super Admin processes it. Open a refund to act on it." />
      <div className="mb-4"><Notice title="Simulated refunds">No bank is contacted and no money moves. Only a masked account reference is kept — never enter a real account number.</Notice></div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="sm:w-64" aria-label="Filter refunds">
          <option value="all">All refunds ({all.length})</option>
          <option value="mine">Needs my action ({mine.length})</option>
          {refundSteps.map((s) => <option key={s.status} value={s.status}>{s.label} ({all.filter((r) => r.status === s.status).length})</option>)}
        </Select>
        {mine.length > 0 && <Badge tone="warning">{mine.length} need your action</Badge>}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title={all.length ? 'No refunds match this filter' : 'No refunds'} description={all.length ? undefined : 'A refund starts when the Head of Port fails a paid booking at physical verification.'} icon={Landmark} /></Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const booking = data.bookings.find((b) => b.id === r.bookingId)
            const at = refundSteps.findIndex((s) => s.status === r.status)
            const hint = refundActionHint(persona.role, r.status)
            const reversed = data.refundReversals.some((x) => x.refundId === r.id)
            return (
              <li key={r.id}>
                <Link
                  to={`/refunds/${r.id}`}
                  className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-brand-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600"
                  aria-label={`Open refund for ${booking?.reference ?? r.bookingId}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">{customerName(data, r.customerId)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium text-slate-900">{booking?.reference ?? r.bookingId}</span>
                        <span className="text-base font-semibold tabular-nums text-slate-900">{formatKobo(r.amount)}</span>
                        <Badge tone={refundTone(r.status)}>{refundSteps[at]?.label}</Badge>
                        {reversed && <Badge tone="danger">Reversed</Badge>}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">{r.reason}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Created {formatDateTime(r.createdAt)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm text-slate-400 group-hover:text-brand-700">
                      {hint ? <Badge tone="warning">{hint.replace('Your action: ', '')}</Badge> : <span className="hidden sm:inline">View</span>}
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </div>
                  <div className="mt-4"><StageTracker steps={refundSteps.map((s) => s.label)} at={r.status === 'processed' ? refundSteps.length : at} label="Refund progress" /></div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
