import { Badge, Card, CardHeader } from '@/components/ui/primitives'
import { isCreditBlocked } from '@/lib/eligibility'
import { formatBp, formatKobo } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { Customer, Kobo } from '@/types/domain'

export function EligibilityCard({ customer, outstanding }: { customer: Customer; outstanding: Kobo }) {
  const e = customer.eligibility
  const usedPct = e.creditThreshold > 0 ? Math.min(100, Math.round((outstanding / e.creditThreshold) * 100)) : 0
  const blocked = isCreditBlocked(e, outstanding)
  return (
    <Card>
      <CardHeader
        title="Customer eligibility"
        description="Set by the Director of Operations"
        action={<Badge tone={e.isPriority ? 'success' : 'neutral'}>{e.isPriority ? 'Priority' : 'Non-Priority'}</Badge>}
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Eligible discount</dt>
          <dd className="font-medium">{e.isPriority ? `Up to ${formatBp(e.eligibleDiscountBp)}` : 'None'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Credit period</dt>
          <dd className="font-medium">{e.isPriority && e.eligibleCreditMonths > 0 ? `Up to ${e.eligibleCreditMonths} month${e.eligibleCreditMonths > 1 ? 's' : ''}` : 'None'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Payment options</dt>
          <dd className="font-medium">{e.isPriority && e.eligibleCreditMonths > 0 ? 'Pay now or after credit' : 'Pay now only'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Category</dt>
          <dd className="font-medium">{e.category}</dd>
        </div>
      </dl>
      {e.isPriority && e.creditThreshold > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500">Outstanding credit</span>
            <span className="tabular-nums text-slate-700">{formatKobo(outstanding)} of {formatKobo(e.creditThreshold)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn('h-full rounded-full', blocked ? 'bg-red-500' : usedPct > 75 ? 'bg-amber-500' : 'bg-brand-500')} style={{ width: `${usedPct}%` }} />
          </div>
          {blocked && <p className="mt-2 text-xs text-red-700">Credit threshold exceeded — further bookings are blocked.</p>}
        </div>
      )}
    </Card>
  )
}
