import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { returnsAfterDecision, returnTarget } from '@/app/returnTarget'
import { ArrowLeft, CircleAlert, CircleCheck, Eye, FilePen, Send, Undo2, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader, RegistrationStatusBadge, Flash } from '@/components/ui/blocks'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, buttonClass, Card, CardHeader } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { RegistrationStages } from '@/features/audit/Timeline'
import { EligibilityCard } from '@/features/customers/EligibilityCard'
import { outstandingCredit } from '@/lib/eligibility'
import { formatDateTime } from '@/lib/format'
import { canAccessPersona } from '@/lib/permissions'
import { documentLabels, runRegistrationChecks } from '@/lib/registration'
import {
  addInternalRemark, directorApprove, directorReject, directorSendBack, districtForward, districtSendBack, validateEligibilityInput,
} from '@/lib/workflow/registration'
import type { Actor, WorkflowResult } from '@/lib/workflow/result'
import type { UploadedDocument } from '@/types/domain'
import { DocumentPreview } from './DocumentPreview'
import { EligibilityForm, emptyEligibility } from './EligibilityForm'
import { ReasonDialog } from './ReasonDialog'

type Dlg = null | 'ds_back' | 'ds_forward' | 'dir_back' | 'dir_reject'

export function RegistrationDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, persona, applicantAppId, act } = useStore()
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)
  const [dialog, setDialog] = useState<Dlg>(null)
  const [preview, setPreview] = useState<UploadedDocument | null>(null)
  const [eligibility, setEligibility] = useState(emptyEligibility())
  const [eligError, setEligError] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')

  const app = data.applications.find((a) => a.id === id)
  const isOwnApplicant = !!persona.isApplicant && applicantAppId === id
  const wrongDistrict = persona.role === 'district_supervisor' && !!app && app.district !== persona.district
  const allowed = (canAccessPersona(persona, 'registrations') && !wrongDistrict) || isOwnApplicant

  if (wrongDistrict && app) return <Notice tone="warning" title={`This application belongs to the ${app.district} district`}>District Supervisors can only view applications from their own district ({persona.district}). <Link to="/registrations" className="underline">Back to your queue</Link></Notice>
  if (!allowed) return <Notice tone="warning" title="You do not have access to this application.">Switch demo role to view it.</Notice>
  if (!app) return <Notice tone="warning" title="Application not found.">It may have been removed by “Reset demo”. <Link to="/dashboard" className="underline">Back to dashboard</Link></Notice>

  const actor: Actor = { name: persona.name, role: persona.role, district: persona.district }
  const isDS = persona.role === 'district_supervisor'
  const isDir = persona.role === 'director_operations'
  const isNrcReviewer = isDS || isDir
  const checks = runRegistrationChecks(app, data.customers, data.applications, data.config.taxCertificateRequired)
  const flagged = checks.filter((c) => !c.passed)
  const customer = app.customerId ? data.customers.find((c) => c.id === app.customerId) : undefined
  const timeline = data.audit.filter((e) => e.entityType === 'registration' && e.entityId === app.id && !(isOwnApplicant && e.internal)).slice().reverse()
  const dsOpen = app.status === 'pending_district_verification' || app.status === 'sent_back_to_district'
  const dirOpen = app.status === 'pending_director_approval'

  const run = <T extends object>(fn: (d: typeof data) => WorkflowResult<T>, success: string): string | null => {
    const before = app.status
    const r = act(fn)
    if (!r.ok) return r.error
    if (returnsAfterDecision(persona.role) && r.data.applications.find((a) => a.id === app.id)?.status !== before) {
      navigate(returnTarget(persona.role), { state: { shellFlash: success } })
      return null
    }
    setFlash(success)
    return null
  }

  const approve = () => {
    const bad = validateEligibilityInput(eligibility)
    if (bad) return setEligError(bad)
    const err = run((d) => directorApprove(d, app.id, actor, eligibility, approveNote), 'Registration approved. Customer activated; username and temporary password generated and emailed (simulated — no credentials are shown or sent).')
    if (err) setEligError(err)
  }

  const addNote = () => {
    const err = run((d) => addInternalRemark(d, app.id, actor, note), 'Internal remark added (not visible to the facilitator).')
    if (err) return setNoteError(err)
    setNote(''); setNoteError('')
  }

  const rows: [string, string][] = [
    ['Company name', app.companyName], ['CAC number', app.cacNumber], ['Registered address', app.registeredAddress], ['District', app.district],
    ['Mode of operations', app.modes.join(', ')], ['Services provided', app.services.join(', ')],
    ['Point of contact', app.poc.name], ['Email', app.poc.email], ['Phone', `${app.poc.countryCode} ${app.poc.phone}`],
    ['Submitted', formatDateTime(app.submittedAt)], ['Last updated', formatDateTime(app.updatedAt)],
  ]

  return (
    <>
      <Link to={isOwnApplicant ? '/dashboard' : '/registrations'} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> {isOwnApplicant ? 'Dashboard' : 'All registrations'}</Link>
      <PageHeader
        title={app.companyName}
        description={<span className="inline-flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{app.reference}</span> <RegistrationStatusBadge status={app.status} /> <Badge>Demo data</Badge></span>}
      />
      <Flash message={flash} onDismiss={() => setFlash(null)} />

      <Card className="mb-6 p-5"><RegistrationStages status={app.status} /></Card>

      {app.latestRemark && ['sent_back_to_facilitator', 'sent_back_to_district', 'rejected'].includes(app.status) && (
        <div className="mb-6"><Notice tone={app.status === 'rejected' ? 'warning' : 'info'} title={app.status === 'sent_back_to_facilitator' ? 'Sent back — comments from the District Supervisor' : app.status === 'sent_back_to_district' ? 'Sent back by the Director' : 'Rejected'}>{app.latestRemark}</Notice></div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Application details" />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>)}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Simulated uploads — previews show metadata only." />
            <ul className="divide-y divide-slate-100">
              {app.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-900">{documentLabels[d.kind]}</span> <span className="block truncate text-xs text-slate-500">{d.fileName} · {d.sizeKb} KB · {formatDateTime(d.uploadedAt)}</span></span>
                  <Button size="sm" variant="secondary" onClick={() => setPreview(d)}><Eye className="size-3.5" /> View</Button>
                </li>
              ))}
              {app.documents.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No documents uploaded.</li>}
            </ul>
          </Card>

          {isNrcReviewer || persona.role === 'super_admin' ? (
            <Card>
              <CardHeader title="Automated checks" description="Duplicate CAC · blacklisted customer · incomplete documentation" />
              <ul className="divide-y divide-slate-100">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-3 px-5 py-3 text-sm">
                    {c.passed ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Passed" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Flagged" />}
                    <span><span className="font-medium text-slate-900">{c.label}</span><span className="block text-xs text-slate-500">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {customer && (
            <div className="grid gap-6 md:grid-cols-2">
              <EligibilityCard customer={customer} outstanding={outstandingCredit(data.bookings, customer.id)} />
              <Card>
                <CardHeader title="Account" description="Generated on approval (simulated)" />
                <dl className="space-y-3 px-5 py-4 text-sm">
                  <div><dt className="text-xs text-slate-500">Username</dt><dd className="font-medium">{customer.username}</dd></div>
                  <div><dt className="text-xs text-slate-500">Temporary password</dt><dd className="font-medium">Issued by email (simulated) · must be changed on first login</dd></div>
                  <div><dt className="text-xs text-slate-500">Activated</dt><dd className="font-medium">{formatDateTime(customer.activatedAt)}</dd></div>
                </dl>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isOwnApplicant && app.status === 'sent_back_to_facilitator' && (
            <Card>
              <CardHeader title="Action required" description="Correct the issues noted above and resubmit." />
              <div className="p-5"><Link to={`/registrations/${app.id}/edit`} className={buttonClass('primary', 'md', 'w-full')}><FilePen className="size-4" /> Correct & resubmit</Link></div>
            </Card>
          )}
          {isOwnApplicant && app.status !== 'sent_back_to_facilitator' && app.status !== 'activated' && app.status !== 'rejected' && (
            <Notice title="Under review">Your application is being processed. You will be notified of each step (emails simulated).</Notice>
          )}
          {isOwnApplicant && app.status === 'activated' && <Notice title="Application approved">Your company is now an active customer. Sign-in credentials were sent by email (simulated). In this prototype, use the role switcher to explore customer screens.</Notice>}

          {persona.role === 'super_admin' && <Notice title="View only">Super Admin can see applications for support but cannot verify, approve or set eligibility.</Notice>}

          {isDS && (
            <Card>
              <CardHeader title="District verification" description="Are the documents genuine and complete? Eligibility is decided by the Director, not here." />
              <div className="space-y-3 p-5">
                {dsOpen ? (
                  <>
                    {flagged.length > 0 && <Notice tone="warning" title={`${flagged.length} automated check${flagged.length > 1 ? 's' : ''} flagged`}>{flagged.map((c) => c.label).join(' · ')}</Notice>}
                    <Button className="w-full" onClick={() => setDialog('ds_forward')}><Send className="size-4" /> Verified — forward to Director</Button>
                    <Button className="w-full" variant="secondary" onClick={() => setDialog('ds_back')}><Undo2 className="size-4" /> Send back to facilitator</Button>
                  </>
                ) : <p className="text-sm text-slate-500">No verification action is pending on this application.</p>}
              </div>
            </Card>
          )}

          {isDir && (
            <Card>
              <CardHeader title="Final decision" description={dirOpen ? 'Set the customer’s permanent eligibility, then approve.' : undefined} />
              <div className="space-y-4 p-5">
                {dirOpen ? (
                  <>
                    <EligibilityForm value={eligibility} onChange={(v) => { setEligibility(v); setEligError('') }} error={eligError} />
                    <Field label="Remarks (optional)"><Textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} /></Field>
                    <Button className="w-full" onClick={approve}><CircleCheck className="size-4" /> Approve & activate</Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => setDialog('dir_back')}><Undo2 className="size-4" /> Send back</Button>
                      <Button variant="danger" onClick={() => setDialog('dir_reject')}><X className="size-4" /> Reject</Button>
                    </div>
                  </>
                ) : <p className="text-sm text-slate-500">{app.status === 'pending_district_verification' || app.status === 'sent_back_to_district' ? 'Awaiting District Supervisor verification.' : 'No decision is pending on this application.'}</p>}
              </div>
            </Card>
          )}

          {isNrcReviewer && (
            <Card>
              <CardHeader title="Internal remark" description="Visible to NRC reviewers only." />
              <div className="space-y-2 p-5">
                <Field label="Remark" error={noteError}><Textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteError('') }} /></Field>
                <Button size="sm" variant="secondary" onClick={addNote}>Add remark</Button>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline" description="Actor, time, status change and remarks" />
            <ActivityList entries={timeline} />
          </Card>
        </div>
      </div>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />

      <ReasonDialog open={dialog === 'ds_back'} onClose={() => setDialog(null)} title="Send back to facilitator" description="The facilitator will see your comments and can correct and resubmit. An email is simulated." label="Comments for the facilitator" confirmLabel="Send back"
        onConfirm={(r) => run((d) => districtSendBack(d, app.id, actor, r), 'Application sent back to the facilitator (email simulated).')} />
      <ReasonDialog open={dialog === 'ds_forward'} onClose={() => setDialog(null)} title="Forward to Director" description={flagged.length ? 'Automated checks flagged this application — explain why it is being forwarded.' : 'Confirm documents are genuine and complete.'} label={flagged.length ? 'Remarks (required — checks flagged)' : 'Remarks (optional)'} required={flagged.length > 0} confirmLabel="Forward"
        onConfirm={(r) => run((d) => districtForward(d, app.id, actor, r), 'Application verified and forwarded to the Director.')} />
      <ReasonDialog open={dialog === 'dir_back'} onClose={() => setDialog(null)} title="Send back to District Supervisor" label="Reason" confirmLabel="Send back"
        onConfirm={(r) => run((d) => directorSendBack(d, app.id, actor, r), 'Application sent back to the District Supervisor.')} />
      <ReasonDialog open={dialog === 'dir_reject'} onClose={() => setDialog(null)} title="Reject registration" description="The applicant is notified with your reason (email simulated)." label="Reason for rejection" confirmLabel="Reject registration" danger
        onConfirm={(r) => run((d) => directorReject(d, app.id, actor, r), 'Registration rejected (email simulated).')} />
    </>
  )
}
