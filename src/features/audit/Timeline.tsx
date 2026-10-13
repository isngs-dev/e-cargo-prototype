import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { RegistrationStatus } from '@/types/domain'
import type { BookingStatus } from '@/types/domain'

export type StageTone = 'normal' | 'warn' | 'failed'

/** Generic progress tracker: stages before `at` are done, `at` is awaiting action (`at === steps.length` → all done). */
export function StageTracker({ steps, at, tone = 'normal', label }: { steps: string[]; at: number; tone?: StageTone; label: string }) {
  return (
    <ol className="flex items-start gap-1" aria-label={label}>
      {steps.map((stage, i) => {
        const done = i < at
        const active = i === at
        const failed = active && tone === 'failed'
        const warn = active && tone === 'warn'
        return (
          <li key={stage} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done || active ? 'bg-brand-500' : 'bg-slate-200')} />
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2',
                  done && 'bg-brand-600 text-white ring-brand-600',
                  active && !failed && !warn && 'bg-white text-brand-700 ring-brand-600',
                  warn && 'bg-amber-50 text-amber-700 ring-amber-500',
                  failed && 'bg-red-50 text-red-700 ring-red-500',
                  !done && !active && 'bg-white text-slate-400 ring-slate-200',
                )}
              >
                {done ? <Check className="size-4" /> : failed ? <X className="size-4" /> : i + 1}
              </span>
              <div className={cn('h-0.5 flex-1', i === steps.length - 1 ? 'opacity-0' : done ? 'bg-brand-500' : 'bg-slate-200')} />
            </div>
            <span className={cn('mt-1.5 text-[11px] leading-tight', active || done ? 'font-medium text-slate-800' : 'text-slate-400')}>{stage}</span>
          </li>
        )
      })}
    </ol>
  )
}

const registrationSteps = ['Submitted', 'District Verification', 'Director Approval', 'Activated']

/** Registration timeline: Submitted → District Verification → Director Approval → Activated. */
export function RegistrationStages({ status }: { status: RegistrationStatus }) {
  const at: Record<RegistrationStatus, [number, StageTone]> = {
    sent_back_to_facilitator: [0, 'warn'],
    pending_district_verification: [1, 'normal'],
    sent_back_to_district: [1, 'warn'],
    pending_director_approval: [2, 'normal'],
    activated: [4, 'normal'],
    rejected: [2, 'failed'],
  }
  const [index, tone] = at[status]
  return <StageTracker steps={registrationSteps} at={index} tone={tone} label="Registration progress" />
}

const bookingSteps = ['Submitted', 'Cargo Review', 'Director Approval', 'Payment / Credit', 'Port Validation', 'AWB Generated']

/** Booking timeline (baseline §8, condensed to six stages). */
export function BookingStages({ status }: { status: BookingStatus }) {
  const at: Record<BookingStatus, [number, StageTone]> = {
    draft: [0, 'normal'],
    sent_back_to_facilitator: [0, 'warn'],
    pending_hoc_review: [1, 'normal'],
    sent_back_to_hoc: [1, 'warn'],
    pending_director_review: [2, 'normal'],
    awaiting_payment: [3, 'normal'],
    credit_approved: [4, 'normal'],
    pending_dispatch: [4, 'normal'],
    awb_generated: [6, 'normal'],
    completed: [6, 'normal'],
    rejected_hoc: [1, 'failed'],
    rejected_director: [2, 'failed'],
    auto_cancelled: [3, 'failed'],
    rejected_physical: [4, 'failed'],
  }
  const [index, tone] = at[status]
  return <StageTracker steps={bookingSteps} at={index} tone={tone} label="Booking progress" />
}
