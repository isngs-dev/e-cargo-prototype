import { useState, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Send } from 'lucide-react'
import { useStore } from '@/app/store'
import { CheckboxGroup, Field } from '@/components/ui/fields'
import { Button, Card, CardHeader, Input, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import {
  allModes,
  allServices,
  countryCodes,
  documentLabels,
  requiredRegistrationDocs,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '@/lib/registration'
import { DISTRICTS, type District, type DocumentKind, type UploadedDocument } from '@/types/domain'
import { DocumentUploader } from './DocumentUploader'
import { liveConfigured } from '@/lib/liveNotify'

export const emptyRegistration = (): RegistrationInput => ({
  companyName: '', cacNumber: '', registeredAddress: '', district: '', modes: [], services: [],
  poc: { name: '', email: '', countryCode: '+234', phone: '' }, documents: [],
})

/** Sample values so stakeholders can demo the form quickly. */
export const demoRegistration = (): RegistrationInput => ({
  companyName: 'Harbour Link Logistics Ltd', cacNumber: 'RC 3412207', registeredAddress: '12 Marine Road, Apapa, Lagos', district: 'Lagos',
  modes: ['Containerized'], services: ['Clearance', 'Multi-modal'],
  poc: { name: 'Zainab Lawal', email: 'zainab.lawal@harbourlink.demo', countryCode: '+234', phone: '803 555 0142' }, documents: [],
})

const stepLabels = ['Company details', 'Documents', 'Review & submit']
const stepFields: Record<number, (keyof RegistrationErrors)[]> = {
  0: ['companyName', 'cacNumber', 'registeredAddress', 'district', 'modes', 'services', 'pocName', 'pocEmail', 'pocPhone'],
  1: ['documents'],
  2: [],
}

export function RegistrationForm({ initial, submitLabel, onSubmit }: { initial: RegistrationInput; submitLabel: string; onSubmit: (v: RegistrationInput) => string | null }) {
  const { data } = useStore()
  const taxRequired = data.config.taxCertificateRequired
  const [v, setV] = useState<RegistrationInput>(initial)
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const demo = demoRegistration()
  /** Tab on an empty field accepts the grey sample value; typing replaces it. */
  const tabFill = (current: string, fill: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !current) fill()
  }
  const errors = validateRegistration(v, taxRequired)
  const stepErrors = stepFields[step]!.filter((k) => errors[k])
  const show = (k: keyof RegistrationErrors) => (touched ? errors[k] : undefined)
  const set = (patch: Partial<RegistrationInput>) => setV((p) => ({ ...p, ...patch }))
  const setPoc = (patch: Partial<RegistrationInput['poc']>) => setV((p) => ({ ...p, poc: { ...p.poc, ...patch } }))

  const next = () => {
    setTouched(true)
    if (stepErrors.length === 0) { setTouched(false); setStep((s) => s + 1) }
  }

  const setDoc = (kind: DocumentKind, doc: UploadedDocument | undefined) =>
    set({ documents: [...v.documents.filter((d) => d.kind !== kind), ...(doc ? [doc] : [])] })

  const submit = () => {
    setTouched(true)
    if (Object.keys(errors).length) {
      setSubmitError('Please correct the highlighted fields before submitting.')
      setStep(stepFields[0]!.some((k) => errors[k]) ? 0 : 1)
      return
    }
    const err = onSubmit(v)
    if (err) setSubmitError(err)
  }

  const requiredDocs = requiredRegistrationDocs(taxRequired)
  const docKinds: DocumentKind[] = ['cac_certificate', 'company_profile', 'tax_certificate']

  return (
    <Card>
      <nav aria-label="Form steps" className="flex border-b border-slate-100 px-2">
        {stepLabels.map((l, i) => (
          <span key={l} aria-current={i === step ? 'step' : undefined} className={cn('flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-medium sm:text-sm', i === step ? 'border-brand-600 text-brand-800' : i < step ? 'border-transparent text-slate-700' : 'border-transparent text-slate-400')}>
            <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', i <= step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500')}>{i + 1}</span>
            <span className="hidden sm:inline">{l}</span>
          </span>
        ))}
      </nav>

      {step === 0 && (
        <>
          <CardHeader title="Company details" description="Fields marked * are mandatory. Grey text is a sample: press Tab to use it, or type your own." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Company name" required error={show('companyName')}><Input value={v.companyName} placeholder={demo.companyName} onKeyDown={tabFill(v.companyName, () => set({ companyName: demo.companyName }))} onChange={(e) => set({ companyName: e.target.value })} autoComplete="organization" /></Field>
            <Field label="CAC number" required error={show('cacNumber')} hint="e.g. RC 1234567"><Input value={v.cacNumber} placeholder={demo.cacNumber} onKeyDown={tabFill(v.cacNumber, () => set({ cacNumber: demo.cacNumber }))} onChange={(e) => set({ cacNumber: e.target.value })} /></Field>
            <Field label="Registered address" required error={show('registeredAddress')} className="sm:col-span-2"><Input value={v.registeredAddress} placeholder={demo.registeredAddress} onKeyDown={tabFill(v.registeredAddress, () => set({ registeredAddress: demo.registeredAddress }))} onChange={(e) => set({ registeredAddress: e.target.value })} /></Field>
            <Field label="District" required error={show('district')} hint="Your application is verified by the District Supervisor of this district.">
              <Select value={v.district} onChange={(e) => set({ district: e.target.value as District | '' })}>
                <option value="">Select a district…</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <div className="hidden sm:block" />
            <CheckboxGroup legend="Mode of operations" required options={allModes} value={v.modes} onChange={(modes) => set({ modes })} error={show('modes')} />
            <CheckboxGroup legend="Services provided" required options={allServices} value={v.services} onChange={(services) => set({ services })} error={show('services')} />
            <Field label="Point of contact name" required error={show('pocName')}><Input value={v.poc.name} placeholder={demo.poc.name} onKeyDown={tabFill(v.poc.name, () => setPoc({ name: demo.poc.name }))} onChange={(e) => setPoc({ name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Point of contact email" required error={show('pocEmail')}><Input type="email" value={v.poc.email} placeholder={demo.poc.email} onKeyDown={tabFill(v.poc.email, () => setPoc({ email: demo.poc.email }))} onChange={(e) => setPoc({ email: e.target.value })} autoComplete="email" /></Field>
            <div>
              <span className="block text-sm font-medium text-slate-800">Contact number <span className="text-red-600" aria-hidden>*</span></span>
              <div className="mt-1 flex gap-2">
                <Select aria-label="Country code" value={v.poc.countryCode} onChange={(e) => setPoc({ countryCode: e.target.value })} className="w-24 shrink-0">
                  {countryCodes.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Input aria-label="Phone number" inputMode="tel" value={v.poc.phone} onChange={(e) => setPoc({ phone: e.target.value })} placeholder={demo.poc.phone} onKeyDown={tabFill(v.poc.phone, () => setPoc({ phone: demo.poc.phone }))} />
              </div>
              {show('pocPhone') && <p role="alert" className="mt-1 text-xs text-red-600">{show('pocPhone')}</p>}
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <CardHeader title="Documents" description="Simulated upload — only the file name and size are recorded. Re-upload any time before submitting." />
          <div className="space-y-3 p-5">
            {docKinds.map((k) => (
              <DocumentUploader key={k} kind={k} required={requiredDocs.includes(k)} doc={v.documents.find((d) => d.kind === k)} onChange={(d) => setDoc(k, d)} />
            ))}
            {!taxRequired && <p className="text-xs text-slate-500">Tax certificate is optional (configurable by Super Admin).</p>}
            {show('documents') && <p role="alert" className="text-sm text-red-600">{show('documents')}</p>}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <CardHeader title="Review & submit" description="Check your details. Your application goes to the District Supervisor for document verification." />
          <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
            {([
              ['Company name', v.companyName], ['CAC number', v.cacNumber], ['Registered address', v.registeredAddress], ['District', v.district],
              ['Mode of operations', v.modes.join(', ')], ['Services', v.services.join(', ')],
              ['Point of contact', v.poc.name], ['Email', v.poc.email], ['Phone', `${v.poc.countryCode} ${v.poc.phone}`],
              ['Documents', v.documents.map((d) => documentLabels[d.kind]).join(', ') || '—'],
            ] as const).map(([k, val]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{val}</dd></div>
            ))}
          </dl>
          <p className="mx-5 mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {liveConfigured()
              ? <>By submitting you agree that NRC e-Cargo sends <strong>real email and SMS</strong> updates about this application to <strong>{v.poc.email}</strong> and <strong>{v.poc.countryCode} {v.poc.phone}</strong>.</>
              : <>Status updates for this application are sent to {v.poc.email} and {v.poc.countryCode} {v.poc.phone} (simulated in this demo).</>}
          </p>
          {submitError && <p role="alert" className="mx-5 mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
        </>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <Button variant="secondary" disabled={step === 0} onClick={() => { setTouched(false); setStep((s) => s - 1) }}><ArrowLeft className="size-4" /> Back</Button>
        {step < 2 ? (
          <Button onClick={next}>Next <ArrowRight className="size-4" /></Button>
        ) : (
          <Button onClick={submit}><Send className="size-4" /> {submitLabel}</Button>
        )}
      </div>
    </Card>
  )
}
