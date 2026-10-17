import { useState } from 'react'
import { FilePen } from 'lucide-react'
import { Field } from '@/components/ui/fields'
import { Button, Card, CardHeader, Input } from '@/components/ui/primitives'
import type { Run } from '@/features/bookings/runTypes'
import { todayISO } from '@/lib/workflow/booking'
import { trainDefaults, trains } from '@/lib/trains'
import { amendAwb, type DispatchInput } from '@/lib/workflow/dispatch'
import type { Actor } from '@/lib/workflow/result'
import type { Booking } from '@/types/domain'

/**
 * Head of Port: amend the dispatch details of an issued AWB. The AWB number never changes — an amendment issues a new
 * version and marks the previous one superseded (it stays on record). Not available once the booking is completed.
 */
export function AmendAwbPanel({ booking, actor, run }: { booking: Booking; actor: Actor; run: Run }) {
  const d = booking.dispatch!
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DispatchInput>({ wagonNumber: d.wagonNumber, trainNumber: d.trainNumber, departureDate: d.departureDate, departureTime: d.departureTime, loadingYard: d.loadingYard ?? '', remarks: d.remarks ?? '' })
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const set = (patch: Partial<DispatchInput>) => { setForm((p) => ({ ...p, ...patch })); setError('') }
  const onTrain = (v: string) => set({ trainNumber: v, ...(trainDefaults(v, todayISO()) ?? {}) })

  const submit = () => {
    const err = run((data) => amendAwb(data, booking.id, form, reason, actor), `AWB amended. Version ${(booking.awb?.version ?? 1) + 1} issued and version ${booking.awb?.version} superseded (distribution emails simulated).`)
    if (err) setError(err)
  }

  return (
    <Card>
      <CardHeader title="Amend AWB" description={`Issues a new version of ${booking.awb?.number}. The number is never edited or reused.`} />
      <div className="space-y-3 p-5">
        {!open ? (
          <Button className="w-full" variant="secondary" onClick={() => setOpen(true)}><FilePen className="size-4" /> Amend dispatch details</Button>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wagon number" required><Input value={form.wagonNumber} onChange={(e) => set({ wagonNumber: e.target.value })} /></Field>
              <Field label="Train number" required hint="A known train fills in the date, time and yard."><Input value={form.trainNumber} onChange={(e) => onTrain(e.target.value)} list="train-list-amend" autoComplete="off" /><datalist id="train-list-amend">{trains.map((t) => <option key={t.trainNumber} value={t.trainNumber}>{t.note}</option>)}</datalist></Field>
              <Field label="Departure date" required><Input type="date" min={todayISO()} value={form.departureDate} onChange={(e) => set({ departureDate: e.target.value })} /></Field>
              <Field label="Departure time" required><Input type="time" value={form.departureTime} onChange={(e) => set({ departureTime: e.target.value })} /></Field>
              <Field label="Loading yard" className="sm:col-span-2"><Input value={form.loadingYard} onChange={(e) => set({ loadingYard: e.target.value })} /></Field>
              <Field label="Reason for amendment" required className="sm:col-span-2"><Input value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} /></Field>
            </div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2"><Button onClick={submit}>Issue amended AWB</Button><Button variant="secondary" onClick={() => { setOpen(false); setError('') }}>Cancel</Button></div>
          </>
        )}
      </div>
    </Card>
  )
}
