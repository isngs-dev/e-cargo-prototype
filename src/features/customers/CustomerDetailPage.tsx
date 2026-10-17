import { newestFirst } from '@/app/selectors'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Ban, CircleCheck, PauseCircle } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader, Flash } from '@/components/ui/blocks'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, Card, CardHeader, Input, Select } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { EligibilityForm, emptyEligibility } from '@/features/registrations/EligibilityForm'
import { ReasonDialog } from '@/features/registrations/ReasonDialog'
import { outstandingCredit } from '@/lib/eligibility'
import { formatDate } from '@/lib/format'
import { countryCodes } from '@/lib/registration'
import { changeCustomerEligibility, correctCustomerRecord, setCustomerAccountStatus } from '@/lib/workflow/customerAdmin'
import type { EligibilityInput } from '@/lib/workflow/registration'
import type { Actor } from '@/lib/workflow/result'
import type { Customer, CustomerAccountStatus } from '@/types/domain'
import { EligibilityCard } from './EligibilityCard'

const tone = { active: 'success', suspended: 'warning', blacklisted: 'danger' } as const

const fromCustomer = (c: Customer): EligibilityInput => ({
  isPriority: c.eligibility.isPriority, discountPct: c.eligibility.eligibleDiscountBp / 100, creditMonths: c.eligibility.eligibleCreditMonths,
  thresholdNaira: c.eligibility.creditThreshold / 100, category: c.eligibility.category,
})

export function CustomerDetailPage() {
  const { id } = useParams()
  const { data, persona, act } = useStore()
  const customer = data.customers.find((c) => c.id === id)
  const [flash, setFlash] = useState<string | null>(null)
  const [status, setStatus] = useState<CustomerAccountStatus | null>(null)
  const [elig, setElig] = useState<EligibilityInput>(() => (customer ? fromCustomer(customer) : emptyEligibility()))
  const [eligReason, setEligReason] = useState('')
  const [eligError, setEligError] = useState('')
  const [eligKey, setEligKey] = useState(0)

  if (!customer) return <Notice tone="warning" title="Customer not found">It may have been removed by “Reset demo”. <Link to="/customers" className="underline">Back to customers</Link></Notice>

  const actor: Actor = { name: persona.name, role: persona.role }
  const isDir = persona.role === 'director_operations'
  const isSA = persona.role === 'super_admin'
  const history = data.audit.filter((e) => e.entityType === 'customer' && e.entityId === customer.id).slice().reverse()
  const bookings = newestFirst(data.bookings.filter((b) => b.customerId === customer.id), (b) => b.createdAt)

  const run = (fn: Parameters<typeof act>[0], msg: string): string | null => {
    const r = act(fn)
    if (!r.ok) return r.error
    setFlash(msg)
    return null
  }
  const saveEligibility = () => {
    const err = run((d) => changeCustomerEligibility(d, customer.id, elig, eligReason, actor), 'Eligibility updated. It applies to future bookings only; approved bookings are unaffected (customer notified, simulated).')
    if (err) return setEligError(err)
    setEligReason(''); setEligError(''); setEligKey((k) => k + 1)
  }

  return (
    <>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> All customers</Link>
      <PageHeader title={customer.companyName} description={<span className="inline-flex flex-wrap items-center gap-2">{customer.cacNumber} · {customer.district} district <Badge tone={tone[customer.accountStatus]}>{customer.accountStatus}</Badge></span>} />
      <Flash message={flash} onDismiss={() => setFlash(null)} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Account" description={`Active since ${formatDate(customer.activatedAt)}`} />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              {([['Address', customer.registeredAddress], ['Modes', customer.modes.join(', ')], ['Services', customer.services.join(', ')], ['Contact', customer.poc.name], ['Email', customer.poc.email], ['Phone', `${customer.poc.countryCode} ${customer.poc.phone}`], ['Username (simulated)', customer.username], ['Bookings', String(bookings.length)]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
              {customer.accountStatus === 'active' && <Button variant="secondary" size="sm" onClick={() => setStatus('suspended')}><PauseCircle className="size-4" /> Suspend</Button>}
              {customer.accountStatus !== 'blacklisted' && <Button variant="secondary" size="sm" onClick={() => setStatus('blacklisted')}><Ban className="size-4" /> Blacklist</Button>}
              {customer.accountStatus !== 'active' && <Button size="sm" onClick={() => setStatus('active')}><CircleCheck className="size-4" /> Reactivate</Button>}
            </div>
          </Card>

          {isDir && (
            <Card key={eligKey}>
              <CardHeader title="Change eligibility" description="Applies to future bookings only. Bookings already approved keep their frozen price and terms." />
              <div className="space-y-4 p-5">
                <EligibilityForm value={elig} onChange={(v) => { setElig(v); setEligError('') }} error={eligError} />
                <Field label="Reason" required><Textarea value={eligReason} onChange={(e) => { setEligReason(e.target.value); setEligError('') }} /></Field>
                <Button onClick={saveEligibility}>Save eligibility change</Button>
              </div>
            </Card>
          )}
          {isSA && <CorrectRecordCard customer={customer} onSave={(patch, reason) => run((d) => correctCustomerRecord(d, customer.id, patch, reason, actor), 'Customer record corrected.')} />}
        </div>

        <div className="space-y-6">
          <EligibilityCard customer={customer} outstanding={outstandingCredit(data.bookings, customer.id)} />
          {isSA && <Notice title="Eligibility is a business decision">Super Admin can suspend, blacklist and correct records, but only the Director sets priority, discount and credit.</Notice>}
          <Card><CardHeader title="History" description="Status and eligibility changes" /><ActivityList entries={history} /></Card>
        </div>
      </div>

      {(['suspended', 'blacklisted', 'active'] as const).map((s) => (
        <ReasonDialog key={s} open={status === s} onClose={() => setStatus(null)} danger={s === 'blacklisted'}
          title={s === 'suspended' ? `Suspend ${customer.companyName}` : s === 'blacklisted' ? `Blacklist ${customer.companyName}` : `Reactivate ${customer.companyName}`}
          description={s === 'active' ? 'The customer can create bookings again.' : 'The customer cannot create new bookings. Approved bookings are unaffected.'}
          label="Reason" confirmLabel={s === 'suspended' ? 'Suspend' : s === 'blacklisted' ? 'Blacklist' : 'Reactivate'}
          onConfirm={(r) => run((d) => setCustomerAccountStatus(d, customer.id, s, r, actor), `Customer ${s === 'active' ? 'reactivated' : s}.`)} />
      ))}
    </>
  )
}

function CorrectRecordCard({ customer, onSave }: { customer: Customer; onSave: (p: Parameters<typeof correctCustomerRecord>[2], reason: string) => string | null }) {
  const [v, setV] = useState({ registeredAddress: customer.registeredAddress, pocName: customer.poc.name, pocEmail: customer.poc.email, pocCountryCode: customer.poc.countryCode, pocPhone: customer.poc.phone })
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof v>) => { setV((p) => ({ ...p, ...patch })); setError('') }
  return (
    <Card>
      <CardHeader title="Correct record" description="Address and contact only — not eligibility, CAC or commercial terms." />
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Registered address" className="sm:col-span-2"><Input value={v.registeredAddress} onChange={(e) => set({ registeredAddress: e.target.value })} /></Field>
        <Field label="Contact name"><Input value={v.pocName} onChange={(e) => set({ pocName: e.target.value })} /></Field>
        <Field label="Contact email"><Input value={v.pocEmail} onChange={(e) => set({ pocEmail: e.target.value })} /></Field>
        <Field label="Phone">
          <div className="flex gap-2"><Select aria-label="Country code" className="w-24 shrink-0" value={v.pocCountryCode} onChange={(e) => set({ pocCountryCode: e.target.value })}>{countryCodes.map((c) => <option key={c}>{c}</option>)}</Select><Input value={v.pocPhone} onChange={(e) => set({ pocPhone: e.target.value })} /></div>
        </Field>
        <Field label="Reason" required><Input value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} /></Field>
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><Button onClick={() => { const err = onSave(v, reason); if (err) setError(err); else setReason('') }}>Save correction</Button></div>
      </div>
    </Card>
  )
}
