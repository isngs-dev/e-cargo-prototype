import type { LucideIcon } from 'lucide-react'
import { Inbox, X } from 'lucide-react'
import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Badge, Card } from './primitives'
import { bookingStatusMeta, paymentStatusMeta, registrationStatusMeta, type Tone } from '@/lib/status'
import type { BookingStatus, PaymentStatus, RegistrationStatus } from '@/types/domain'
import type { Ageing } from '@/lib/sla'

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const kpiAccent: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-red-50 text-red-700',
  accent: 'bg-violet-50 text-violet-700',
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'neutral', to }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: Tone; to?: string }) {
  const card = (
    <Card className={cn('flex h-full flex-col p-4', to && 'transition-colors group-hover:border-brand-300 group-hover:shadow-sm')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        </div>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', kpiAccent[tone])}>
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      {hint ? <p className="mt-auto pt-2 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  )
  return to ? <Link to={to} className="group block h-full rounded-lg">{card}</Link> : card
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const m = bookingStatusMeta[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}
export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const m = registrationStatusMeta[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const m = paymentStatusMeta[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn('rounded border border-dashed border-slate-300 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-500', className)}>
      Demo data
    </span>
  )
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warning'; title: string; children?: ReactNode }) {
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', tone === 'info' ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-amber-200 bg-amber-50 text-amber-900')}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 opacity-90">{children}</div>}
    </div>
  )
}

/** Dismissible success / result message shown after an action. */
export function Flash({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  const failed = message.startsWith('Not done:')
  return (
    <div
      role="status"
      className={cn('mb-4 flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm', failed ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900')}
    >
      <p>{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"><X className="size-4" /></button>
    </div>
  )
}

const ageTone: Record<Ageing['level'], string> = {
  ok: 'bg-slate-100 text-slate-700 ring-slate-200',
  due: 'bg-amber-50 text-amber-800 ring-amber-200',
  overdue: 'bg-orange-100 text-orange-800 ring-orange-300',
  escalated: 'bg-red-100 text-red-800 ring-red-300',
}

/** How long an item has waited at its current approval stage vs the (proposed) target. Indicator only — never auto-approves. */
export function AgeingBadge({ ageing }: { ageing: Ageing | null }) {
  if (!ageing) return <span className="text-xs text-slate-300">—</span>
  const word = { ok: '', due: ' · due soon', overdue: ' · overdue', escalated: ' · escalate' }[ageing.level]
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ageTone[ageing.level])} title={`Target ${ageing.targetHours}h (proposed). Nothing is ever auto-approved.`}>
      {ageing.label}{word}
    </span>
  )
}
