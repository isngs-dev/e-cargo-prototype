import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CircleAlert, CircleCheck, Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { RegistrationStatusBadge } from '@/components/ui/blocks'
import { Button, buttonClass, Card, Input } from '@/components/ui/primitives'
import { RegistrationStages } from '@/features/audit/Timeline'
import { formatDateTime } from '@/lib/format'
import type { RegistrationApplication } from '@/types/domain'

const WHAT_NEXT: Record<RegistrationApplication['status'], (a: RegistrationApplication) => string> = {
  pending_district_verification: (a) => `Your application is with the District Supervisor (${a.district}) for document verification.`,
  pending_director_approval: () => 'Your documents are verified. The Director of Operations will make the final decision.',
  sent_back_to_facilitator: () => 'The District Supervisor needs corrections before the application can continue.',
  sent_back_to_district: () => 'Your application is under internal review. No action is needed from you.',
  activated: () => 'Approved. Your sign-in details were emailed to the contact email on the application.',
  rejected: () => 'Your application was not approved.',
}

/** Public: track a registration by its reference. Looks in THIS browser's demo data only (like Verify an AWB). */
export function TrackApplicationPage() {
  const { data } = useStore()
  const [params, setParams] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const [input, setInput] = useState(ref)
  const app = ref ? data.applications.find((a) => a.reference.toLowerCase() === ref.trim().toLowerCase()) : undefined
  const showRemark = app && (app.status === 'sent_back_to_facilitator' || app.status === 'rejected') && app.latestRemark

  return (
    <PublicLayout>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Track your application</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the reference you received when you registered, for example <span className="font-mono">REG-2026-0108</span>.</p>

        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { ref: input.trim() } : {}) }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="REG-2026-0108" aria-label="Application reference" className="font-mono" />
          <Button type="submit"><Search className="size-4" /> Track</Button>
        </form>

        {ref && !app && (
          <Card className="mt-6 p-5" aria-live="polite">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-6 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm"><p className="text-base font-semibold text-slate-900">No application found</p><p className="mt-1 text-slate-600">There is no application with the reference <span className="font-mono">{ref}</span>. Check it and try again.</p></div>
            </div>
          </Card>
        )}

        {app && (
          <Card className="mt-6 p-5" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{app.companyName}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{app.reference} · {app.district} district</p>
              </div>
              <RegistrationStatusBadge status={app.status} />
            </div>
            <div className="mt-5"><RegistrationStages status={app.status} /></div>
            <div className="mt-5 flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              {app.status === 'activated' ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />}
              <div>
                <p>{WHAT_NEXT[app.status](app)}</p>
                {showRemark && <p className="mt-2 text-slate-600">“{app.latestRemark}”</p>}
              </div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
              <div><dt className="inline">Submitted: </dt><dd className="inline text-slate-700">{formatDateTime(app.submittedAt)}</dd></div>
              <div><dt className="inline">Last updated: </dt><dd className="inline text-slate-700">{formatDateTime(app.updatedAt)}</dd></div>
            </dl>
            {(app.status === 'activated' || app.status === 'sent_back_to_facilitator') && (
              <div className="mt-5"><Link to="/login" className={buttonClass('primary')}>{app.status === 'activated' ? 'Sign in to NRC e-Cargo' : 'Sign in to correct your application'}</Link></div>
            )}
          </Card>
        )}
        <p className="mt-6 text-xs text-slate-400">Demonstration: this looks the reference up in this browser’s demo data only.</p>
      </section>
    </PublicLayout>
  )
}
