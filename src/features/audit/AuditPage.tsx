import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Card, Input, Select, Table, Td, Th } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import type { EntityType } from '@/types/domain'
import { actorRoleLabel, humanStatus } from './ActivityList'

const entityLabels: Record<EntityType, string> = {
  registration: 'Registration', booking: 'Booking', customer: 'Customer', staff: 'Staff', master_data: 'Master data', refund: 'Refund', payment: 'Payment', system: 'System',
}

export function AuditPage() {
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<EntityType | 'all'>('all')
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.audit]
      .reverse()
      .filter((e) => (entity === 'all' || e.entityType === entity) && (!q || [e.entityRef, e.action, e.actorName, e.remarks ?? ''].some((s) => s.toLowerCase().includes(q))))
  }, [data.audit, entity, query])

  return (
    <>
      <PageHeader title="Audit log" description="Actor, role, timestamp, action, status transition and remarks for every recorded action." />
      <div className="mb-4">
        <Notice tone="warning" title="Demonstration audit trail">
          Stored in this browser only and editable via developer tools. Production requires database-trigger, insert-only auditing with IP capture (not simulated here).
        </Notice>
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, action, actor, remarks" className="pl-9" aria-label="Search audit log" />
          </div>
          <Select value={entity} onChange={(e) => setEntity(e.target.value as EntityType | 'all')} className="sm:w-56" aria-label="Filter by entity">
            <option value="all">All entities</option>
            {(Object.keys(entityLabels) as EntityType[]).map((k) => <option key={k} value={k}>{entityLabels[k]}</option>)}
          </Select>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Timestamp</Th>
              <Th>Actor</Th>
              <Th>Record</Th>
              <Th>Action</Th>
              <Th>Transition / change</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <Td className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(e.at)}</Td>
                <Td>
                  <p className="whitespace-nowrap">{e.actorName}</p>
                  <p className="text-xs text-slate-500">{actorRoleLabel(e.actorRole)}</p>
                </Td>
                <Td>
                  <p className="font-mono text-xs">{e.entityRef}</p>
                  <p className="text-xs text-slate-500">{entityLabels[e.entityType]}</p>
                </Td>
                <Td>
                  <p>{e.action}</p>
                  {e.remarks && <p className="mt-0.5 text-xs text-slate-500">“{e.remarks}”</p>}
                </Td>
                <Td className="text-xs">
                  {e.toStatus && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      {e.fromStatus ? humanStatus(e.fromStatus) : 'new'} <ArrowRight className="size-3" /> {humanStatus(e.toStatus)}
                    </span>
                  )}
                  {e.change && <p className="text-slate-600">{e.change.field}: {e.change.from} → {e.change.to}</p>}
                  {!e.toStatus && !e.change && <span className="text-slate-400">—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="px-4 py-3 text-xs text-slate-500">{entries.length} entries</p>
      </Card>
    </>
  )
}
