import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { RegistrationStatus } from '@/types/domain'

const steps = ['Submitted', 'District Verification', 'Director Approval', 'Activated']

/** Stage tracker: Submitted → District Verification → Director Approval → Activated. */
export function RegistrationStages({ status }: { status: RegistrationStatus }) {
  // Index of the stage awaiting action; stages before it are complete.
  const current: Record<RegistrationStatus, number> = {
    sent_back_to_facilitator: 0,
    pending_district_verification: 1,
    sent_back_to_district: 1,
    pending_director_approval: 2,
    activated: 4,
    rejected: 2,
  }
  const at = current[status]
  const warn = status === 'sent_back_to_facilitator' || status === 'sent_back_to_district'
  return (
    <ol className="flex items-start gap-1" aria-label="Registration progress">
      {steps.map((label, i) => {
        const done = i < at
        const active = i === at
        const failed = active && status === 'rejected'
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done || active ? 'bg-brand-500' : 'bg-slate-200')} />
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2',
                  done && 'bg-brand-600 text-white ring-brand-600',
                  active && !failed && !warn && 'bg-white text-brand-700 ring-brand-600',
                  active && warn && 'bg-amber-50 text-amber-700 ring-amber-500',
                  failed && 'bg-red-50 text-red-700 ring-red-500',
                  !done && !active && 'bg-white text-slate-400 ring-slate-200',
                )}
              >
                {done ? <Check className="size-4" /> : failed ? <X className="size-4" /> : i + 1}
              </span>
              <div className={cn('h-0.5 flex-1', i === steps.length - 1 ? 'opacity-0' : done ? 'bg-brand-500' : 'bg-slate-200')} />
            </div>
            <span className={cn('mt-1.5 text-[11px] leading-tight', active || done ? 'font-medium text-slate-800' : 'text-slate-400')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
