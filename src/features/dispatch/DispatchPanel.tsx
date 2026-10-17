import { useState } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { containerSummary } from '@/app/selectors'
import { Field } from '@/components/ui/fields'
import { Button, Card, CardHeader, Input } from '@/components/ui/primitives'
import { ReasonDialog } from '@/features/registrations/ReasonDialog'
import type { Run } from '@/features/bookings/runTypes'
import { todayISO } from '@/lib/workflow/booking'
import { findTrain, trainDefaults, trains } from '@/lib/trains'
import { approveDispatch, emptyChecks, emptyDispatch, failPhysicalVerification, validateDispatch, type PhysicalChecks } from '@/lib/workflow/dispatch'
import type { Actor } from '@/lib/workflow/result'
import type { Booking } from '@/types/domain'

/** Head of Port: physical verification, dispatch details, and AWB generation. */
export function DispatchPanel({ booking, actor, run }: { booking: Booking; actor: Actor; run: Run }) {
  const [checks, setChecks] = useState<PhysicalChecks>(emptyChecks())
  const [form, setForm] = useState(emptyDispatch())
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [failOpen, setFailOpen] = useState(false)
  const [autoFilled, setAutoFilled] = useState('')
  const notBefore = booking.bookingDate > todayISO() ? booking.bookingDate : todayISO()
  /** A known train number fills in departure date (next running day), time and loading yard. */
  const onTrain = (v: string) => {
    const t = trainDefaults(v, notBefore)
    set({ trainNumber: v, ...(t ?? {}) })
    setAutoFilled(t ? v.trim().toUpperCase() : '')
  }

  const errors = validateDispatch(form, checks, booking.hazardous)
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined)
  const set = (patch: Partial<typeof form>) => { setForm((p) => ({ ...p, ...patch })); setError('') }
  const tick = (k: keyof PhysicalChecks) => { setChecks((c) => ({ ...c, [k]: !c[k] })); setError('') }

  const items: [keyof PhysicalChecks, string][] = [
    ['counts', `Container / wagon count matches the declaration (${containerSummary(booking)})`],
    ['cargoAndWeight', `Cargo type and weight match the declaration (${booking.commodity}, ${booking.weightTons} t)`],
    ['condition', 'Condition and suitability for dispatch'],
    ...(booking.hazardous ? ([['hazardous', 'Hazardous handling compliance confirmed']] as [keyof PhysicalChecks, string][]) : []),
  ]

  const approve = () => {
    setTouched(true)
    if (Object.keys(errors).length) return setError('Complete the highlighted items before approving dispatch.')
    const err = run((d) => approveDispatch(d, booking.id, form, checks, actor), 'Dispatch approved and AWB generated. It is shared with the customer, Head of Cargo, Director and Head of Port (emails simulated).')
    if (err) setError(err)
  }

  return (
    <Card>
      <CardHeader title="Physical verification & dispatch" description="Inspect the consignment, record dispatch details, then approve to generate the AWB." />
      <div className="space-y-4 p-5">
        <p className="text-xs text-slate-500">Add photos of the containers in the <a href="#container-photos" className="font-medium text-brand-700 underline">Container photos</a> card — the Director and the customer can view them.</p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Physical verification <span className="text-red-600" aria-hidden>*</span></legend>
          <div className="space-y-2">
            {items.map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2.5 text-sm hover:bg-slate-50">
                <input type="checkbox" className="mt-0.5 accent-brand-600" checked={checks[k]} onChange={() => tick(k)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {booking.hazardous && <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><TriangleAlert className="size-3.5" /> Hazardous cargo — handling compliance must be confirmed.</p>}
          {show('checks') && <p role="alert" className="mt-1 text-xs text-red-600">{show('checks')}</p>}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Wagon number" required error={show('wagonNumber')}><Input value={form.wagonNumber} onChange={(e) => set({ wagonNumber: e.target.value })} placeholder="NRC-FW-30001" /></Field>
          <Field label="Train number" required error={show('trainNumber')} hint={autoFilled ? `Autofilled from the timetable (${findTrain(autoFilled)?.note}). Edit if different.` : 'Pick a train to fill in the date, time and yard.'}>
            <Input value={form.trainNumber} onChange={(e) => onTrain(e.target.value)} placeholder="LI-FR-09" list="train-list" autoComplete="off" />
            <datalist id="train-list">{trains.map((t) => <option key={t.trainNumber} value={t.trainNumber}>{t.note}</option>)}</datalist>
          </Field>
          <Field label="Departure date" required error={show('departureDate')}><Input type="date" min={todayISO()} value={form.departureDate} onChange={(e) => set({ departureDate: e.target.value })} /></Field>
          <Field label="Departure time" required error={show('departureTime')}><Input type="time" value={form.departureTime} onChange={(e) => set({ departureTime: e.target.value })} /></Field>
          <Field label="Loading yard" className="sm:col-span-2"><Input value={form.loadingYard} onChange={(e) => set({ loadingYard: e.target.value })} placeholder="Apapa Yard A" /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Input value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
        </div>

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button className="w-full" onClick={approve}><CircleCheck className="size-4" /> Approve dispatch & generate AWB</Button>
        <Button className="w-full" variant="danger" onClick={() => setFailOpen(true)}><X className="size-4" /> Physical check failed — cancel & report to Director</Button>
      </div>
      <ReasonDialog
        open={failOpen} onClose={() => setFailOpen(false)} danger confirmLabel="Cancel booking & report"
        title="Physical verification failed" label="Reason (reported to the Director)"
        description="The booking is cancelled and capacity is released. If the customer has already paid, the refund flow starts with the Director."
        onConfirm={(r) => run((d) => failPhysicalVerification(d, booking.id, r, actor), 'Booking cancelled and reported to the Director. Capacity released.')}
      />
    </Card>
  )
}
