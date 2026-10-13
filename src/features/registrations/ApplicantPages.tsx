import { Navigate, useNavigate, useParams } from 'react-router'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { resubmitRegistration, submitRegistration } from '@/lib/workflow/registration'
import type { Actor } from '@/lib/workflow/result'
import { emptyRegistration, RegistrationForm } from './RegistrationForm'

/** `/my-registration` — send the demo applicant to their application, or to the form if they have none. */
export function MyRegistrationRedirect() {
  const { data, applicantAppId } = useStore()
  const exists = data.applications.some((a) => a.id === applicantAppId)
  return <Navigate to={exists ? `/registrations/${applicantAppId}` : '/register'} replace />
}

export function NewRegistrationPage() {
  const { persona, act } = useStore()
  const navigate = useNavigate()

  const onSubmit = (v: Parameters<typeof submitRegistration>[1]) => {
    const actor: Actor = { name: v.poc.name || persona.name, role: 'cargo_facilitator' }
    const r = act((d) => submitRegistration(d, v, actor), { claimApplication: true })
    if (!r.ok) return r.error
    navigate(`/registrations/${r.applicationId}`, { state: { flash: 'Application submitted. It is now with the District Supervisor for verification (confirmation email simulated).' } })
    return null
  }

  return (
    <>
      <PageHeader title="Register your company" description="Apply to become a registered NRC cargo facilitator." />
      <div className="mb-4"><Notice title="Demonstration">Submitting creates a new application in this browser only. No email is sent and uploaded files are not stored.</Notice></div>
      <RegistrationForm initial={emptyRegistration()} submitLabel="Submit application" onSubmit={onSubmit} />
    </>
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
