import { Link } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { useStore } from '@/app/store'
import { buttonClass, Card } from '@/components/ui/primitives'
import { canAccessPersona, roleLabels, type Area } from '@/lib/permissions'

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
