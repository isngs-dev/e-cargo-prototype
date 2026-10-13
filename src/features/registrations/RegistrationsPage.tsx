import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Card, Input, Select } from '@/components/ui/primitives'
import { registrationStatusMeta } from '@/lib/status'
import type { RegistrationStatus } from '@/types/domain'
import { RegistrationTable } from './RegistrationTable'

export function RegistrationsPage() {
  const { data, persona } = useStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<RegistrationStatus | 'all'>('all')
  const all = [...data.applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (a) => (status === 'all' || a.status === status) && (!q || [a.reference, a.companyName, a.cacNumber, a.poc.name].some((s) => s.toLowerCase().includes(q))),
    )
  }, [all, query, status])

  return (
    <>
      <PageHeader title="Registrations" description="Cargo facilitator onboarding applications." />
      {persona.role === 'super_admin' && (
        <div className="mb-4">
          <Notice title="View only">Super Admin can view applications for support purposes but cannot verify or approve them.</Notice>
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, company, CAC, contact" className="pl-9" aria-label="Search registrations" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as RegistrationStatus | 'all')} className="sm:w-72" aria-label="Filter by status">
            <option value="all">All statuses ({all.length})</option>
            {(Object.keys(registrationStatusMeta) as RegistrationStatus[]).map((s) => (
              <option key={s} value={s}>{registrationStatusMeta[s].label} ({all.filter((a) => a.status === s).length})</option>
            ))}
          </Select>
        </div>
        <RegistrationTable applications={filtered} emptyTitle="No applications match your filters" />
        <p className="px-4 py-3 text-xs text-slate-500">Showing {filtered.length} of {all.length} · demonstration data</p>
      </Card>
    </>
  )
}
