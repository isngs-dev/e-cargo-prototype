import { ArrowRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/blocks'
import { formatDateTime } from '@/lib/format'
import { roleLabels } from '@/lib/permissions'
import type { AuditEntry } from '@/types/domain'

export const actorRoleLabel = (r: AuditEntry['actorRole']) => (r === 'system' ? 'System' : roleLabels[r])
export const humanStatus = (s: string) => s.replace(/_/g, ' ')

export function ActivityList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <EmptyState title="No activity yet" />
  return (
    <ol className="divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id} className="px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-sm text-slate-900">
              <span className="font-mono text-xs text-slate-500">{e.entityRef}</span> · {e.action}{e.internal && <span className="ml-2 rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase text-slate-600">Internal</span>}
            </p>
            <time className="text-xs tabular-nums text-slate-500">{formatDateTime(e.at)}</time>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {e.actorName} · {actorRoleLabel(e.actorRole)}
            {e.toStatus && (
              <span className="ml-2 inline-flex items-center gap-1 capitalize">
                {e.fromStatus ? humanStatus(e.fromStatus) : 'new'} <ArrowRight className="size-3" /> {humanStatus(e.toStatus)}
              </span>
            )}
          </p>
          {e.remarks && <p className="mt-1 text-xs text-slate-600">“{e.remarks}”</p>}
        </li>
      ))}
    </ol>
  )
}
