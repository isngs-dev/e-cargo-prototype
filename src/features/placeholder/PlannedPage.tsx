import { Link } from 'react-router'
import { Construction, ShieldCheck } from 'lucide-react'
import { planDescriptions, navItems } from '@/app/navigation'
import { useStore } from '@/app/store'
import { PageHeader } from '@/components/ui/blocks'
import { buttonClass, Card } from '@/components/ui/primitives'
import { canAccessPersona, roleLabels, type Area } from '@/lib/permissions'

/** Honest placeholder for a screen scheduled in a later implementation phase. */
export function PlannedPage({ area }: { area: Area }) {
  const item = navItems.find((i) => i.area === area)
  const plan = planDescriptions[area]
  return (
    <>
      <PageHeader title={plan?.title ?? 'Coming soon'} />
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <Construction className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">Scheduled for implementation phase {item?.phase}</p>
            <p className="mt-1 text-sm text-slate-500">This screen is not built yet. Planned scope:</p>
            {plan && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {plan.scope.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
            <Link to="/dashboard" className={buttonClass('secondary', 'sm', 'mt-5')}>Back to dashboard</Link>
          </div>
        </div>
      </Card>
    </>
  )
}

export function RequireArea({ area, children }: { area: Area; children: React.ReactNode }) {
  const { persona } = useStore()
  if (canAccessPersona(persona, area)) return <>{children}</>
  return (
    <Card className="p-8 text-center">
      <ShieldCheck className="mx-auto size-8 text-slate-400" aria-hidden />
      <p className="mt-3 text-sm font-medium text-slate-900">Not available to {roleLabels[persona.role]}</p>
      <p className="mt-1 text-sm text-slate-500">This area is restricted by the role access matrix. Switch demo role to view it.</p>
      <Link to="/dashboard" className={buttonClass('secondary', 'sm', 'mt-4')}>Back to dashboard</Link>
    </Card>
  )
}

export function NotFoundPage() {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-medium text-slate-900">Page not found</p>
      <Link to="/dashboard" className={buttonClass('secondary', 'sm', 'mt-4')}>Back to dashboard</Link>
    </Card>
  )
}
