import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Send, Trash2, TriangleAlert } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice } from '@/components/ui/blocks'
import { Field, Textarea } from '@/components/ui/fields'
import { Button, Card, CardHeader, Input, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import {
  containerTypesFor, indicativePrice, OPTIONAL_BOOKING_DOCS, requiredBookingDocs, todayISO, validateBooking,
  type BookingErrors, type BookingInput,
} from '@/lib/workflow/booking'
import type { CargoType, Customer, DocumentKind, UploadedDocument } from '@/types/domain'
import { DocumentUploader } from '@/features/registrations/DocumentUploader'
import { PriceBreakdown } from './PriceBreakdown'

const COMMODITIES = ['Packaged beverages', 'Bagged cement', 'Bagged maize', 'Building materials', 'Consumer electronics', 'Steel billets', 'Textiles', 'Agro-chemicals']
const steps = ['Shipment', 'Documents', 'Review & submit']
const stepFields: Record<number, (keyof BookingErrors)[]> = { 0: ['bookingDate', 'routeId', 'containers', 'weightTons', 'commodity'], 1: ['documents'], 2: ['declaration'] }

export function BookingForm({ customer, initial, onSubmit }: { customer: Customer; initial: BookingInput; onSubmit: (v: BookingInput) => string | null }) {
  const { data } = useStore()
  const [v, setV] = useState<BookingInput>(initial)
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const errors = validateBooking(v)
  const stepErrors = stepFields[step]!.filter((k) => errors[k])
  const show = (k: keyof BookingErrors) => (touched ? errors[k] : undefined)
  const set = (patch: Partial<BookingInput>) => setV((p) => ({ ...p, ...patch }))
  const isPriority = customer.eligibility.isPriority
  const activeRoutes = data.routes.filter((r) => r.active)

  const price = useMemo(() => indicativePrice(data, customer, v), [data, customer, v])
  const priceError = !price.ok && v.routeId ? price.error : undefined

  const setCargo = (cargoType: CargoType) => set({ cargoType, containers: [{ containerType: containerTypesFor(cargoType)[0]!, quantity: 1 }] })
  const setLine = (i: number, patch: Partial<BookingInput['containers'][number]>) => set({ containers: v.containers.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const unusedTypes = containerTypesFor(v.cargoType).filter((t) => !v.containers.some((c) => c.containerType === t))
  const setDoc = (kind: DocumentKind, doc: UploadedDocument | undefined) => set({ documents: [...v.documents.filter((d) => d.kind !== kind), ...(doc ? [doc] : [])] })

  const next = () => {
    setTouched(true)
    if (stepErrors.length) return
    if (step === 0 && priceError) return
    setTouched(false)
    setStep((s) => s + 1)
  }
  const submit = () => {
    setTouched(true)
    const first = Object.keys(errors)[0] as keyof BookingErrors | undefined
    if (first) {
      setSubmitError('Please correct the highlighted fields before submitting.')
      setStep(stepFields[0]!.includes(first) ? 0 : stepFields[1]!.includes(first) ? 1 : 2)
      return
    }
    const err = onSubmit(v)
    if (err) setSubmitError(err)
  }

  const requiredDocs = requiredBookingDocs(v.hazardous)
  const docKinds: DocumentKind[] = [...requiredBookingDocs(v.hazardous), ...OPTIONAL_BOOKING_DOCS]
  const route = data.routes.find((r) => r.id === v.routeId)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <nav aria-label="Form steps" className="flex border-b border-slate-100 px-2">
          {steps.map((l, i) => (
            <span key={l} aria-current={i === step ? 'step' : undefined} className={cn('flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-medium sm:text-sm', i === step ? 'border-brand-600 text-brand-800' : i < step ? 'border-transparent text-slate-700' : 'border-transparent text-slate-400')}>
              <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', i <= step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500')}>{i + 1}</span>
              <span className="hidden sm:inline">{l}</span>
            </span>
          ))}
        </nav>

        {step === 0 && (
          <>
            <CardHeader title="Shipment details" description="Fields marked * are mandatory." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Booking date" required error={show('bookingDate')}><Input type="date" min={todayISO()} value={v.bookingDate} onChange={(e) => set({ bookingDate: e.target.value })} /></Field>
              <Field label="Cargo type" required>
                <Select value={v.cargoType} onChange={(e) => setCargo(e.target.value as CargoType)}><option>Containerized</option><option>Non-Containerized</option></Select>
              </Field>
              <Field label="Route" required error={show('routeId')} className="sm:col-span-2">
                <Select value={v.routeId} onChange={(e) => set({ routeId: e.target.value })}>
                  <option value="">Select a route…</option>
                  {activeRoutes.map((r) => <option key={r.id} value={r.id}>{r.origin} → {r.destination} ({r.distanceKm} km)</option>)}
                </Select>
              </Field>

              <div className="sm:col-span-2">
                <p className="mb-1 text-sm font-medium text-slate-800">{v.cargoType === 'Containerized' ? 'Containers' : 'Wagons'} <span className="text-red-600" aria-hidden>*</span></p>
                <div className="space-y-2">
                  {v.containers.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select aria-label="Container type" value={c.containerType} onChange={(e) => setLine(i, { containerType: e.target.value as typeof c.containerType })} className="w-40" disabled={v.cargoType !== 'Containerized'}>
                        {containerTypesFor(v.cargoType).filter((t) => t === c.containerType || unusedTypes.includes(t)).map((t) => <option key={t}>{t}</option>)}
                      </Select>
                      <Input aria-label="Quantity" type="number" min={1} step={1} value={Number.isNaN(c.quantity) ? '' : c.quantity} onChange={(e) => setLine(i, { quantity: e.target.value === '' ? NaN : Number(e.target.value) })} className="w-28" />
                      <span className="text-xs text-slate-500">{v.cargoType === 'Containerized' ? 'containers' : 'wagons'}</span>
                      {v.containers.length > 1 && <Button size="sm" variant="ghost" onClick={() => set({ containers: v.containers.filter((_, j) => j !== i) })} aria-label="Remove line"><Trash2 className="size-3.5" /></Button>}
                    </div>
                  ))}
                </div>
                {v.cargoType === 'Containerized' && unusedTypes.length > 0 && (
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => set({ containers: [...v.containers, { containerType: unusedTypes[0]!, quantity: 1 }] })}><Plus className="size-3.5" /> Add container type</Button>
                )}
                {show('containers') && <p role="alert" className="mt-1 text-xs text-red-600">{show('containers')}</p>}
              </div>

              <Field label="Total weight (tons)" required error={show('weightTons')}><Input type="number" min={0} step={0.1} value={Number.isNaN(v.weightTons) ? '' : v.weightTons} onChange={(e) => set({ weightTons: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field>
              <Field label="Commodity type" required error={show('commodity')}>
                <Input list="commodities" value={v.commodity} onChange={(e) => set({ commodity: e.target.value })} />
                <datalist id="commodities">{COMMODITIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>

              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-sm font-medium text-slate-800">Hazardous cargo</legend>
                <div className="flex gap-2">
                  {[false, true].map((h) => (
                    <label key={String(h)} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', v.hazardous === h ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white hover:bg-slate-50')}>
                      <input type="radio" name="hazardous" className="accent-brand-600" checked={v.hazardous === h} onChange={() => set({ hazardous: h })} /> {h ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
                {v.hazardous && <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><TriangleAlert className="size-3.5" /> A compliance document will be required in the next step.</p>}
              </fieldset>
              <Field label="Special handling" className="sm:col-span-2"><Input value={v.specialHandling} onChange={(e) => set({ specialHandling: e.target.value })} placeholder="e.g. keep upright, segregate from foodstuffs" /></Field>
              <Field label="Remarks" className="sm:col-span-2"><Textarea value={v.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
            </div>
            {touched && priceError && <p role="alert" className="mx-5 mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{priceError}</p>}
          </>
        )}

        {step === 1 && (
          <>
            <CardHeader title="Documents" description="Simulated upload — only the file name and size are recorded. Submission is blocked without the mandatory documents." />
            <div className="space-y-3 p-5">
              {docKinds.map((k) => (
                <DocumentUploader key={k} kind={k} required={requiredDocs.includes(k)} doc={v.documents.find((d) => d.kind === k)} onChange={(d) => setDoc(k, d)} />
              ))}
              <p className="text-xs text-slate-500">Radiation Certificate and Customs Clearance are optional uploads (whether they are mandatory is pending NRC confirmation).</p>
              {show('documents') && <p role="alert" className="text-sm text-red-600">{show('documents')}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader title="Review & submit" description="Submitting sends the booking to the Head of Cargo. No payment is taken." />
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              {([
                ['Booking date', v.bookingDate], ['Cargo type', v.cargoType],
                ['Route', route ? `${route.origin} → ${route.destination}` : '—'],
                [v.cargoType === 'Containerized' ? 'Containers' : 'Wagons', v.containers.map((c) => `${c.quantity} × ${c.containerType}`).join(', ')],
                ['Weight', `${v.weightTons} t`], ['Commodity', v.commodity], ['Hazardous', v.hazardous ? 'Yes' : 'No'],
                ['Special handling', v.specialHandling || '—'], ['Documents', v.documents.length ? `${v.documents.length} uploaded` : '—'],
              ] as const).map(([k, val]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{val}</dd></div>)}
            </dl>
            <div className="px-5 pb-5">
              <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm', show('declaration') ? 'border-red-400 bg-red-50' : 'border-slate-300')}>
                <input type="checkbox" className="mt-0.5 accent-brand-600" checked={v.declaration} onChange={(e) => set({ declaration: e.target.checked })} />
                <span>I confirm compliance with NRC Fair Cargo Policy, and I accept the indicative amount and terms shown.</span>
              </label>
              {show('declaration') && <p role="alert" className="mt-1 text-xs text-red-600">{show('declaration')}</p>}
              {priceError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{priceError}</p>}
              {submitError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button variant="secondary" disabled={step === 0} onClick={() => { setTouched(false); setSubmitError(''); setStep((s) => s - 1) }}><ArrowLeft className="size-4" /> Back</Button>
          {step < 2 ? <Button onClick={next}>Next <ArrowRight className="size-4" /></Button> : <Button onClick={submit} disabled={!!priceError}><Send className="size-4" /> Submit booking</Button>}
        </div>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <PriceBreakdown price={price.ok ? price.price : undefined} error={priceError} showDiscount={isPriority} mode="indicative" />
        {isPriority ? (
          <Notice title={`Priority — eligible discount ${customer.eligibility.eligibleDiscountBp / 100}%`}>The Director sets your final discount (never above this) and chooses payment terms at approval.</Notice>
        ) : (
          <Notice title="Non-Priority">Payment is by payment link after Director approval. No booking-level discount applies.</Notice>
        )}
      </div>
    </div>
  )
}
