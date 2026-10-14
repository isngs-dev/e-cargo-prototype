import { useMemo, useState } from 'react'
import { ArrowRight, Download, Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Button, Card, Input, Select, Table, Td, Th } from '@/components/ui/primitives'
import { toCsv } from '@/lib/csv'
import { formatDateTime } from '@/lib/format'
import { roleLabels } from '@/lib/permissions'
import type { AuditEntry, EntityType, Role } from '@/types/domain'
import { actorRoleLabel, humanStatus } from './ActivityList'

const entityLabels: Record<EntityType, string> = {
  registration: 'Registration', booking: 'Booking', customer: 'Customer', staff: 'Staff', master_data: 'Master data', refund: 'Refund', payment: 'Payment', system: 'System',
}

export function AuditPage() {
  const { data, persona } = useStore()
  const [query, setQuery] = useState('')
  const [entity, setEntity] = useState<EntityType | 'all'>('all')
  const [role, setRole] = useState<AuditEntry['actorRole'] | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.audit].reverse().filter((e) =>
      (entity === 'all' || e.entityType === entity) &&
      (role === 'all' || e.actorRole === role) &&
      (!from || e.at.slice(0, 10) >= from) &&
      (!to || e.at.slice(0, 10) <= to) &&
      (!q || [e.entityRef, e.action, e.actorName, e.remarks ?? '', e.change ? `${e.change.field} ${e.change.from} ${e.change.to}` : ''].some((s) => s.toLowerCase().includes(q))),
    )
  }, [data.audit, entity, role, from, to, query])

  const exportCsv = () => {
    const csv = toCsv(
      ['Timestamp', 'Actor', 'Role', 'Entity type', 'Record', 'Action', 'From status', 'To status', 'Changed field', 'Old value', 'New value', 'Remarks'],
      entries.map((e) => [e.at, e.actorName, actorRoleLabel(e.actorRole), entityLabels[e.entityType], e.entityRef, e.action, e.fromStatus ?? '', e.toStatus ?? '', e.change?.field ?? '', e.change?.from ?? '', e.change?.to ?? '', e.remarks ?? '']),
    )
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nrc-ecargo-demo-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Actor, role, timestamp, action, status transition and remarks for every recorded action."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={entries.length === 0}><Download className="size-4" /> Export CSV ({entries.length})</Button>}
      />
      <div className="mb-4">
        <Notice tone="warning" title="Demonstration audit trail">
          Stored in this browser only and editable via developer tools. Production requires database-trigger, insert-only auditing with IP capture (not simulated here). {persona.role === 'super_admin' ? 'Super Admin sees all activity.' : 'The Director sees all activity.'}
        </Notice>
      </div>
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search record, action, actor, remarks" className="pl-9" aria-label="Search audit log" />
          </div>
          <Select value={entity} onChange={(e) => setEntity(e.target.value as EntityType | 'all')} aria-label="Filter by entity">
            <option value="all">All entities</option>
            {(Object.keys(entityLabels) as EntityType[]).map((k) => <option key={k} value={k}>{entityLabels[k]}</option>)}
          </Select>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role | 'system' | 'all')} aria-label="Filter by actor role">
            <option value="all">All actor roles</option>
            {(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
            <option value="system">System</option>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span className="text-xs text-slate-400">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
        </div>
        <Table>
          <thead>
            <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Record</Th><Th>Action</Th><Th>Transition / change</Th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <Td className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(e.at)}</Td>
                <Td><p className="whitespace-nowrap">{e.actorName}</p><p className="text-xs text-slate-500">{actorRoleLabel(e.actorRole)}</p></Td>
                <Td><p className="font-mono text-xs">{e.entityRef}</p><p className="text-xs text-slate-500">{entityLabels[e.entityType]}</p></Td>
                <Td><p>{e.action}</p>{e.remarks && <p className="mt-0.5 text-xs text-slate-500">“{e.remarks}”</p>}</Td>
                <Td className="text-xs">
                  {e.toStatus && <span className="inline-flex items-center gap-1 capitalize">{e.fromStatus ? humanStatus(e.fromStatus) : 'new'} <ArrowRight className="size-3" /> {humanStatus(e.toStatus)}</span>}
                  {e.change && <p className="text-slate-600">{e.change.field}: {e.change.from} → {e.change.to}</p>}
                  {!e.toStatus && !e.change && <span className="text-slate-400">—</span>}
                </Td>
              </tr>
            ))}
            {entries.length === 0 && <tr><Td className="py-8 text-center text-slate-500" colSpan={5}>No entries match your filters.</Td></tr>}
          </tbody>
        </Table>
        <p className="px-4 py-3 text-xs text-slate-500">{entries.length} of {data.audit.length} entries</p>
      </Card>
    </>
  )
}
