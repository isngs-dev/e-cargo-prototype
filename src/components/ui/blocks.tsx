import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Badge, Card } from './primitives'
import { bookingStatusMeta, paymentStatusMeta, registrationStatusMeta, type Tone } from '@/lib/status'
import type { BookingStatus, PaymentStatus, RegistrationStatus } from '@/types/domain'

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

export function KpiCard({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        </div>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', kpiAccent[tone])}>
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
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
