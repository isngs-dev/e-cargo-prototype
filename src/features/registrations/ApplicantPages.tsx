import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CircleCheck } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { buttonClass, Card } from '@/components/ui/primitives'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { resubmitRegistration, submitRegistration } from '@/lib/workflow/registration'
import type { Actor } from '@/lib/workflow/result'
import { emptyRegistration, RegistrationForm } from './RegistrationForm'
import { deliveryLine, liveConfigured } from '@/lib/liveNotify'

/** `/my-registration` — send the demo applicant to their application, or to the form if they have none. */
export function MyRegistrationRedirect() {
  const { data, applicantAppId } = useStore()
  const exists = data.applications.some((a) => a.id === applicantAppId)
  return <Navigate to={exists ? `/registrations/${applicantAppId}` : '/register'} replace />
}

/** `/register` — public page: nobody needs to be signed in to apply. */
export function NewRegistrationPage() {
  const { act } = useStore()
  const navigate = useNavigate()

  const onSubmit = (v: Parameters<typeof submitRegistration>[1]) => {
    const actor: Actor = { name: v.poc.name || 'Applicant', role: 'cargo_facilitator' }
    const r = act((d) => submitRegistration(d, v, actor), { claimApplication: true })
    if (!r.ok) return r.error
    navigate('/register/submitted')
    return null
  }

  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Register your company</h1>
        <p className="mt-1 text-sm text-slate-500">Apply to become a registered NRC cargo facilitator.</p>
        <div className="my-4" />
        <RegistrationForm initial={emptyRegistration()} submitLabel="Submit application" onSubmit={onSubmit} />
      </section>
    </PublicLayout>
  )
}

/** `/register/submitted` — public confirmation after applying. */
export function RegistrationSubmittedPage() {
  const { data, applicantAppId, state } = useStore()
  const app = data.applications.find((a) => a.id === applicantAppId)
  if (!app) return <Navigate to="/register" replace />
  const live = Object.values(state.liveDelivery).filter((d) => d.appId === app.id && d.kind === 'registration_received').sort((a, b) => b.at.localeCompare(a.at))[0]
  return (
    <PublicLayout>
      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center">
          <CircleCheck className="mx-auto size-10 text-brand-600" aria-hidden />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Application submitted</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{app.reference}</p>
          <p className="mt-3 text-sm text-slate-600">{app.companyName} is now with the District Supervisor ({app.district}) for document verification, then the Director of Operations. Keep your reference — you can track the application any time. Sign-in details are emailed once the Director approves it.</p>
          {liveConfigured() && live && deliveryLine(live) ? (
            <p role="status" className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{deliveryLine(live)}</p>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Email and SMS are simulated in this demo — see the Mail Outbox.</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to={`/track?ref=${app.reference}`} className={buttonClass('primary')}>Track your application</Link>
            <Link to="/" className={buttonClass('secondary')}>Back to home page</Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  )
}

export function EditRegistrationPage() {
  const { id } = useParams()
  const { data, persona, applicantAppId, act } = useStore()
  const navigate = useNavigate()
  const app = data.applications.find((a) => a.id === id)

  if (!app || !persona.isApplicant || applicantAppId !== app.id) return <Notice tone="warning" title="You cannot edit this application." />
  if (app.status !== 'sent_back_to_facilitator') return <Notice tone="warning" title="This application is not awaiting correction.">Only applications sent back by the District Supervisor can be edited and resubmitted.</Notice>

  const onSubmit = (v: Parameters<typeof submitRegistration>[1]) => {
    const actor: Actor = { name: v.poc.name || persona.name, role: 'cargo_facilitator', applicantAppId: app.id }
    const r = act((d) => resubmitRegistration(d, app.id, v, actor))
    if (!r.ok) return r.error
    navigate(`/registrations/${app.id}`, { state: { flash: 'Application resubmitted to the District Supervisor (email simulated).' } })
    return null
  }

  return (
    <>
      <PageHeader title="Correct and resubmit" description={`${app.reference} · ${app.companyName}`} />
      {app.latestRemark && <div className="mb-4"><Notice tone="warning" title="District Supervisor’s comments">{app.latestRemark}</Notice></div>}
      <RegistrationForm initial={{ companyName: app.companyName, cacNumber: app.cacNumber, registeredAddress: app.registeredAddress, district: app.district, modes: app.modes, services: app.services, poc: app.poc, documents: app.documents }} submitLabel="Resubmit application" onSubmit={onSubmit} />
    </>
  )
}
