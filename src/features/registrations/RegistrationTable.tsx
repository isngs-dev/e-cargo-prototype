import { CircleAlert, CircleCheck } from 'lucide-react'
import { useStore } from '@/app/store'
import { EmptyState, RegistrationStatusBadge } from '@/components/ui/blocks'
import { Table, Td, Th } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { runRegistrationChecks } from '@/lib/registration'
import type { RegistrationApplication } from '@/types/domain'

export function RegistrationTable({ applications, emptyTitle = 'No applications' }: { applications: RegistrationApplication[]; emptyTitle?: string }) {
  const { data } = useStore()
  if (applications.length === 0) return <EmptyState title={emptyTitle} />
  return (
    <Table>
      <thead>
        <tr>
          <Th>Application</Th>
          <Th>Company</Th>
          <Th>Point of contact</Th>
          <Th>Automated checks</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {applications.map((a) => {
          const failed = runRegistrationChecks(a, data.customers, data.applications, data.config.taxCertificateRequired).filter((c) => !c.passed)
          return (
            <tr key={a.id} className="hover:bg-slate-50/60">
              <Td>
                <p className="whitespace-nowrap font-mono text-xs font-medium text-slate-900">{a.reference}</p>
                <p className="text-xs text-slate-500">{formatDateTime(a.submittedAt)}</p>
              </Td>
              <Td>
                <p className="font-medium text-slate-900">{a.companyName}</p>
                <p className="text-xs text-slate-500">{a.cacNumber}</p>
              </Td>
              <Td>
                <p>{a.poc.name}</p>
                <p className="whitespace-nowrap text-xs text-slate-500">{a.poc.countryCode} {a.poc.phone}</p>
              </Td>
              <Td>
                {a.status === 'activated' || a.status === 'rejected' ? (
                  <span className="text-xs text-slate-400">—</span>
                ) : failed.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CircleCheck className="size-3.5" /> All passed</span>
                ) : (
                  <ul className="space-y-0.5">
                    {failed.map((c) => (
                      <li key={c.key} className="flex items-start gap-1 text-xs text-red-700" title={c.detail}>
                        <CircleAlert className="mt-px size-3.5 shrink-0" /> {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </Td>
              <Td><RegistrationStatusBadge status={a.status} /></Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
