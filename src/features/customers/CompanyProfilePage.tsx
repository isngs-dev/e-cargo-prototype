import { useStore } from '@/app/store'
import { DemoTag, Notice, PageHeader } from '@/components/ui/blocks'
import { Card, CardHeader } from '@/components/ui/primitives'
import { outstandingCredit } from '@/lib/eligibility'
import { formatDate } from '@/lib/format'
import { documentLabels } from '@/lib/registration'
import { EligibilityCard } from './EligibilityCard'

export function CompanyProfilePage() {
  const { data, persona } = useStore()
  const customer = data.customers.find((c) => c.id === persona.customerId)
  if (!customer) return <Notice tone="warning" title="No company is linked to this demo persona." />
  const application = data.applications.find((a) => a.customerId === customer.id)

  const rows: [string, string][] = [
    ['Company name', customer.companyName],
    ['CAC number', customer.cacNumber],
    ['Registered address', customer.registeredAddress],
    ['Mode of operations', customer.modes.join(', ')],
    ['Services provided', customer.services.join(', ')],
    ['Point of contact', customer.poc.name],
    ['POC email', customer.poc.email],
    ['POC phone', `${customer.poc.countryCode} ${customer.poc.phone}`],
    ['Username (simulated)', customer.username],
    ['Activated', formatDate(customer.activatedAt)],
  ]

  return (
    <>
      <PageHeader title="Company profile" description={<span className="inline-flex items-center gap-2">Registered details and eligibility <DemoTag /></span>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Registration details" description={application ? `Application ${application.reference}` : undefined} />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {application && (
            <Card>
              <CardHeader title="Registration documents" description="Simulated uploads — previews arrive with the registration workflow (Phase 3)." />
              <ul className="divide-y divide-slate-100">
                {application.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-900">{documentLabels[d.kind]}</span>
                      <span className="ml-2 text-xs text-slate-500">{d.fileName} · {d.sizeKb} KB</span>
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(d.uploadedAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <EligibilityCard customer={customer} outstanding={outstandingCredit(data.bookings, customer.id)} />
      </div>
    </>
  )
}
