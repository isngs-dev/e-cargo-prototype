import { Link } from 'react-router'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { buttonClass, Card, CardHeader } from '@/components/ui/primitives'
import { availability, loadLevel, type LoadLevel } from '@/lib/capacity'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/workflow/booking'

const cell: Record<LoadLevel, string> = {
  open: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  limited: 'bg-amber-50 text-amber-800 ring-amber-200',
  full: 'bg-red-50 text-red-700 ring-red-200',
  maintenance: 'bg-slate-200 text-slate-700 ring-slate-300',
}
const legend: [LoadLevel, string][] = [['open', 'Slots available'], ['limited', 'Limited (25% or less left)'], ['full', 'Full'], ['maintenance', 'Maintenance block']]

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Train capacity dashboard — the next 14 days per route. Simulated; the capacity rule is pending NRC confirmation (D-6). */
export function CapacityPage() {
  const { data, persona } = useStore()
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i))
  const routes = data.routes.filter((r) => r.active)
  return (
    <>
      <PageHeader
        title="Train capacity"
        description="Capacity units used per route and date over the next 14 days. Bookings that are rejected or cancelled release their capacity."
        actions={persona.role === 'super_admin' ? <Link to="/master-data" className={buttonClass('secondary')}>Edit capacity & maintenance</Link> : undefined}
      />
      <div className="mb-4"><Notice title="Simulated capacity">20ft = 1 unit, 40ft = 2, Reefer = 2, Wagon = 1. Daily capacity per route and the maintenance blocks are demo values — NRC has not confirmed the capacity rule.</Notice></div>
      <Card>
        <CardHeader title="Next 14 days" description="Used / daily capacity" />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[820px] border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="w-40 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Route</th>
                {days.map((d) => (
                  <th key={d} className="font-medium text-slate-500">{new Date(`${d}T12:00:00`).toLocaleDateString('en-NG', { weekday: 'short' })}<br />{d.slice(8)}/{d.slice(5, 7)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="text-left font-medium text-slate-900">{r.code}<span className="block text-[11px] font-normal text-slate-500">{r.destination}</span></th>
                  {days.map((d) => {
                    const a = availability(data, r.id, d)
                    const level = loadLevel(a)
                    return (
                      <td key={d} className={cn('rounded px-1 py-2 font-medium tabular-nums ring-1 ring-inset', cell[level])} title={a.blockedReason ?? `${a.remaining} unit(s) left`}>
                        {level === 'maintenance' ? 'Blocked' : a.capacity === null ? '—' : `${a.used}/${a.capacity}`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
          {legend.map(([k, label]) => <li key={k} className="flex items-center gap-1.5"><span className={cn('size-3 rounded ring-1 ring-inset', cell[k])} /> {label}</li>)}
        </ul>
      </Card>
    </>
  )
}
