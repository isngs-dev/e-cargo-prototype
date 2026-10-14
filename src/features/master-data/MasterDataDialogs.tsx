import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/fields'
import { Button, Input, Select } from '@/components/ui/primitives'
import { containerTypesFor, todayISO } from '@/lib/workflow/booking'
import type { RateInput, RouteInput } from '@/lib/workflow/masterData'
import type { ISODate } from '@/types/domain'
import type { CargoType, ContainerType, PlatformConfig, Route } from '@/types/domain'

const footer = (onClose: () => void, submit: () => void, label: string) => (
  <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{label}</Button></>
)
const err = (e: string) => (e ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{e}</p> : null)

export function RateDialog({ open, routes, onClose, onSubmit }: { open: boolean; routes: Route[]; onClose: () => void; onSubmit: (v: RateInput) => string | null }) {
  const [routeId, setRouteId] = useState('')
  const [cargoType, setCargo] = useState<CargoType>('Containerized')
  const [containerType, setType] = useState<ContainerType>('20ft')
  const [rate, setRate] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const reset = () => { setRouteId(''); setCargo('Containerized'); setType('20ft'); setRate(''); setDate(''); setError('') }
  const close = () => { reset(); onClose() }
  const submit = () => {
    const e = onSubmit({ routeId, cargoType, containerType, rateNaira: rate === '' ? NaN : Number(rate), effectiveFrom: date })
    if (e) return setError(e)
    close()
  }
  return (
    <Dialog open={open} onClose={close} title="Add freight rate" description="Inserts a new effective-dated row. Existing rows are never edited or removed." footer={footer(close, submit, 'Add rate')}>
      <div className="space-y-3">
        <Field label="Route" required><Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setError('') }}><option value="">Select…</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.origin} → {r.destination}</option>)}</Select></Field>
        <Field label="Cargo type" required><Select value={cargoType} onChange={(e) => { const c = e.target.value as CargoType; setCargo(c); setType(containerTypesFor(c)[0]!); setError('') }}><option>Containerized</option><option>Non-Containerized</option></Select></Field>
        <Field label="Container / wagon type" required><Select value={containerType} onChange={(e) => { setType(e.target.value as ContainerType); setError('') }}>{containerTypesFor(cargoType).map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Rate per unit (₦)" required><Input type="number" min={0} step={1000} value={rate} onChange={(e) => { setRate(e.target.value); setError('') }} /></Field>
        <Field label="Effective from" required hint="Today or later."><Input type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setError('') }} /></Field>
        {err(error)}
      </div>
    </Dialog>
  )
}

export function RouteDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: RouteInput) => string | null }) {
  const [code, setCode] = useState('')
  const [origin, setOrigin] = useState('Apapa Port')
  const [destination, setDestination] = useState('')
  const [km, setKm] = useState('')
  const [error, setError] = useState('')
  const close = () => { setCode(''); setOrigin('Apapa Port'); setDestination(''); setKm(''); setError(''); onClose() }
  const submit = () => {
    const e = onSubmit({ code, origin, destination, distanceKm: km === '' ? NaN : Number(km) })
    if (e) return setError(e)
    close()
  }
  return (
    <Dialog open={open} onClose={close} title="Add route" description="A new route cannot be booked until freight rates are added for it." footer={footer(close, submit, 'Add route')}>
      <div className="space-y-3">
        <Field label="Route code" required hint="e.g. APP-IKJ"><Input value={code} onChange={(e) => { setCode(e.target.value); setError('') }} /></Field>
        <Field label="Origin" required><Input value={origin} onChange={(e) => { setOrigin(e.target.value); setError('') }} /></Field>
        <Field label="Destination" required><Input value={destination} onChange={(e) => { setDestination(e.target.value); setError('') }} /></Field>
        <Field label="Distance (km)" required><Input type="number" min={0} value={km} onChange={(e) => { setKm(e.target.value); setError('') }} /></Field>
        {err(error)}
      </div>
    </Dialog>
  )
}

export function ConfigDialog({ open, config, onClose, onSubmit }: { open: boolean; config: PlatformConfig; onClose: () => void; onSubmit: (c: PlatformConfig, reason: string) => string | null }) {
  const [c, setC] = useState<PlatformConfig>(config)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) { setSeeded(true); setC(structuredClone(config)); setReason(''); setError('') }
  if (!open && seeded) setSeeded(false)

  const pct = (bp: number) => (Number.isFinite(bp) ? bp / 100 : '')
  const setTax = (patch: Partial<PlatformConfig['tax']>) => { setC((p) => ({ ...p, tax: { ...p.tax, ...patch } })); setError('') }
  const num = (v: string) => (v === '' ? NaN : Number(v))
  const submit = () => {
    const e = onSubmit(c, reason)
    if (e) return setError(e)
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title="Edit configuration" description="Applies to new bookings and approvals only. Frozen prices are unaffected. Each changed setting is audit-logged." footer={footer(onClose, submit, 'Save changes')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="VAT (%)"><Input type="number" step="0.25" value={pct(c.tax.vatBp)} onChange={(e) => setTax({ vatBp: Math.round(num(e.target.value) * 100) })} /></Field>
        <Field label="Stamp duty (%)"><Input type="number" step="0.05" value={pct(c.tax.stampDutyBp)} onChange={(e) => setTax({ stampDutyBp: Math.round(num(e.target.value) * 100) })} /></Field>
        <Field label="Insurance (%)"><Input type="number" step="0.25" value={pct(c.tax.insuranceBp)} onChange={(e) => setTax({ insuranceBp: Math.round(num(e.target.value) * 100) })} /></Field>
        <Field label="Tax basis" hint="Unresolved NRC decision (open item D-1)."><Select value={c.tax.basis} onChange={(e) => setTax({ basis: e.target.value as 'net' | 'gross' })}><option value="net">Net freight (after discount)</option><option value="gross">Gross freight (before discount)</option></Select></Field>
        <Field label="Payment window (hours)"><Input type="number" value={Number.isNaN(c.paymentWindowHours) ? '' : c.paymentWindowHours} onChange={(e) => { setC({ ...c, paymentWindowHours: num(e.target.value) }); setError('') }} /></Field>
        <Field label="Payment reminder (hours)"><Input type="number" value={Number.isNaN(c.paymentReminderHours) ? '' : c.paymentReminderHours} onChange={(e) => { setC({ ...c, paymentReminderHours: num(e.target.value) }); setError('') }} /></Field>
        <Field label="Refund window (days)"><Input type="number" value={Number.isNaN(c.refundWindowDays) ? '' : c.refundWindowDays} onChange={(e) => { setC({ ...c, refundWindowDays: num(e.target.value) }); setError('') }} /></Field>
        <Field label="Tax certificate at registration"><Select value={String(c.taxCertificateRequired)} onChange={(e) => { setC({ ...c, taxCertificateRequired: e.target.value === 'true' }); setError('') }}><option value="false">Optional</option><option value="true">Required</option></Select></Field>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">Approval targets (hours) — proposed, indicator only</p>
        {([['registrationDistrictHours', 'Registration — District Supervisor'], ['registrationDirectorHours', 'Registration — Director'], ['bookingCargoHours', 'Booking — Head of Cargo'], ['bookingDirectorHours', 'Booking — Director'], ['dispatchHours', 'Dispatch — Head of Port']] as const).map(([k, label]) => (
          <Field key={k} label={label}><Input type="number" min={1} value={Number.isNaN(c.sla[k]) ? '' : c.sla[k]} onChange={(e) => { setC({ ...c, sla: { ...c.sla, [k]: num(e.target.value) } }); setError('') }} /></Field>
        ))}
        <Field label="Reason / reference (optional)" className="sm:col-span-2"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. NRC letter ref" /></Field>
        <div className="sm:col-span-2">{err(error)}</div>
      </div>
    </Dialog>
  )
}

export function CapacityDialog({ open, routes, current, onClose, onSubmit }: { open: boolean; routes: Route[]; current: (routeId: string) => number | undefined; onClose: () => void; onSubmit: (routeId: string, units: number) => string | null }) {
  const [routeId, setRouteId] = useState('')
  const [units, setUnits] = useState('')
  const [error, setError] = useState('')
  const close = () => { setRouteId(''); setUnits(''); setError(''); onClose() }
  const submit = () => {
    const e = onSubmit(routeId, units === '' ? NaN : Number(units))
    if (e) return setError(e)
    close()
  }
  return (
    <Dialog open={open} onClose={close} title="Set daily train capacity" description="Capacity units per day (20ft = 1, 40ft = 2, Reefer = 2, Wagon = 1). Existing bookings are not cancelled." footer={footer(close, submit, 'Save capacity')}>
      <div className="space-y-3">
        <Field label="Route" required>
          <Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setUnits(String(current(e.target.value) ?? '')); setError('') }}>
            <option value="">Select…</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.destination}</option>)}
          </Select>
        </Field>
        <Field label="Daily capacity (units)" required><Input type="number" min={1} value={units} onChange={(e) => { setUnits(e.target.value); setError('') }} /></Field>
        {err(error)}
      </div>
    </Dialog>
  )
}

export function MaintenanceDialog({ open, routes, onClose, onSubmit }: { open: boolean; routes: Route[]; onClose: () => void; onSubmit: (v: { routeId: string; date: ISODate; reason: string }) => string | null }) {
  const [routeId, setRouteId] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const close = () => { setRouteId(''); setDate(''); setReason(''); setError(''); onClose() }
  const submit = () => {
    const e = onSubmit({ routeId, date, reason })
    if (e) return setError(e)
    close()
  }
  return (
    <Dialog open={open} onClose={close} title="Add maintenance block" description="No bookings can be made for the route on this date." footer={footer(close, submit, 'Add block')}>
      <div className="space-y-3">
        <Field label="Route" required><Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setError('') }}><option value="">Select…</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.destination}</option>)}</Select></Field>
        <Field label="Date" required><Input type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setError('') }} /></Field>
        <Field label="Reason" required><Input value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} placeholder="e.g. Track maintenance" /></Field>
        {err(error)}
      </div>
    </Dialog>
  )
}
