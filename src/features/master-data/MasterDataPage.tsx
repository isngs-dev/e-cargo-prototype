import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader, Flash } from '@/components/ui/blocks'
import { Badge, Button, Card, CardHeader, Table, Td, Th } from '@/components/ui/primitives'
import { findRate } from '@/lib/pricing'
import { formatDate } from '@/lib/format'
import { formatBp, formatKobo } from '@/lib/money'
import { addMaintenanceBlock, addRoute, insertFreightRate, removeMaintenanceBlock, setRouteActive, setRouteCapacity, updateConfig } from '@/lib/workflow/masterData'
import type { Actor } from '@/lib/workflow/result'
import type { CargoType, ContainerType } from '@/types/domain'
import { CapacityDialog, ConfigDialog, MaintenanceDialog, RateDialog, RouteDialog } from './MasterDataDialogs'

const columns: [CargoType, ContainerType][] = [
  ['Containerized', '20ft'],
  ['Containerized', '40ft'],
  ['Containerized', 'Reefer'],
  ['Non-Containerized', 'Wagon'],
]

type Dlg = null | 'rate' | 'route' | 'config' | 'capacity' | 'maintenance'

export function MasterDataPage() {
  const { data, persona, act } = useStore()
  const [dialog, setDialog] = useState<Dlg>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const { tax } = data.config
  const isSA = persona.role === 'super_admin'
  const actor: Actor = { name: persona.name, role: persona.role }

  const run = (fn: Parameters<typeof act>[0], msg: string): string | null => {
    const r = act(fn)
    if (!r.ok) return r.error
    setFlash(msg)
    return null
  }

  return (
    <>
      <PageHeader
        title="Routes & freight rates"
        description="Route & Freight Rate Master and platform configuration. Rates are illustrative demo values, not NRC tariffs."
        actions={isSA ? (
          <>
            <Button variant="secondary" onClick={() => setDialog('route')}><Plus className="size-4" /> Add route</Button>
            <Button variant="secondary" onClick={() => setDialog('config')}><Settings2 className="size-4" /> Edit configuration</Button>
            <Button onClick={() => setDialog('rate')}><Plus className="size-4" /> Add rate</Button>
          </>
        ) : undefined}
      />
      <div className="mb-4">
        <Notice title={isSA ? 'Rates are inserted, never edited' : 'View only'}>
          {isSA
            ? 'Adding a rate inserts a new effective-dated row; earlier rows are kept. Changes never alter bookings that already have an approved (frozen) price. Every change is audit-logged.'
            : 'The Director can view master data; only Super Admin configures it.'}
        </Notice>
      </div>
      <Flash message={flash} onDismiss={() => setFlash(null)} />
      <Card>
        <CardHeader title="Current rate per unit" description={`Rate in force today (${formatDate(today)}). Containerized rates are per container; non-containerized per wagon (demo assumption).`} />
        <Table>
          <thead>
            <tr>
              <Th>Route</Th>
              {columns.map(([c, t]) => <Th key={t} className="text-right">{c === 'Containerized' ? t : 'Non-cont. / wagon'}</Th>)}
              {isSA && <Th>Status</Th>}
            </tr>
          </thead>
          <tbody>
            {data.routes.map((r) => (
              <tr key={r.id} className={r.active ? '' : 'opacity-60'}>
                <Td>
                  <p className="font-medium text-slate-900">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-slate-500">{r.code} · {r.distanceKm} km</p>
                </Td>
                {columns.map(([c, t]) => {
                  const rate = findRate(data.freightRates, r.id, c, t, today)
                  return (
                    <Td key={t} className="text-right tabular-nums">
                      {rate ? formatKobo(rate.ratePerUnit) : <Badge tone="danger">No rate — booking blocked</Badge>}
                    </Td>
                  )
                })}
                {isSA && (
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => run((d) => setRouteActive(d, r.id, !r.active, actor), `Route ${r.code} ${r.active ? 'deactivated' : 'activated'}.`)}>{r.active ? 'Deactivate' : 'Activate'}</Button>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rate history" description="Insert-only, effective-dated rows" />
          <Table>
            <thead>
              <tr><Th>Route</Th><Th>Type</Th><Th className="text-right">Rate</Th><Th>Effective from</Th></tr>
            </thead>
            <tbody>
              {[...data.freightRates].sort((a, b) => a.routeId.localeCompare(b.routeId) || a.containerType.localeCompare(b.containerType) || b.effectiveFrom.localeCompare(a.effectiveFrom)).map((fr) => (
                <tr key={fr.id}>
                  <Td className="font-mono text-xs">{data.routes.find((r) => r.id === fr.routeId)?.code}</Td>
                  <Td className="text-xs">{fr.cargoType} · {fr.containerType}</Td>
                  <Td className="text-right tabular-nums">{formatKobo(fr.ratePerUnit)}</Td>
                  <Td className="text-xs">{formatDate(fr.effectiveFrom)}{fr.effectiveFrom > today && <Badge tone="info" className="ml-2">Scheduled</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Taxes, levies & windows" description="Applied to new bookings and approvals" />
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['VAT', formatBp(tax.vatBp)],
              ['Stamp Duty', formatBp(tax.stampDutyBp)],
              ['Goods in Transit Insurance', formatBp(tax.insuranceBp)],
              ['Tax basis', tax.basis === 'net' ? 'Net freight (after discount)' : 'Gross freight (before discount)'],
              ['Payment window (unpaid auto-cancel)', `${data.config.paymentWindowHours} hours`],
              ['Payment reminder', `${data.config.paymentReminderHours} hours`],
              ['Refund request window', `${data.config.refundWindowDays} days`],
              ['Tax certificate at registration', data.config.taxCertificateRequired ? 'Required' : 'Optional'],
              ['Approval targets (proposed)', `Dist. ${data.config.sla.registrationDistrictHours}h · Dir. reg. ${data.config.sla.registrationDirectorHours}h · Cargo ${data.config.sla.bookingCargoHours}h · Dir. booking ${data.config.sla.bookingDirectorHours}h · Dispatch ${data.config.sla.dispatchHours}h`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-2.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-amber-800">Tax basis, payment window and refund window are unresolved NRC decisions — proposed values shown.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Train capacity & maintenance"
          description="Simulated daily capacity per route (units) and dates when a route is blocked — pending NRC confirmation."
          action={isSA ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setDialog('capacity')}>Set capacity</Button><Button size="sm" variant="secondary" onClick={() => setDialog('maintenance')}>Add maintenance block</Button></div> : undefined}
        />
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Daily capacity</p>
            <ul className="space-y-1 text-sm">
              {data.routes.map((r) => <li key={r.id} className="flex justify-between"><span>{r.code}</span><span className="font-medium tabular-nums">{data.capacity.find((c) => c.routeId === r.id)?.dailyUnits ?? 'unconstrained'}{data.capacity.find((c) => c.routeId === r.id) ? ' units' : ''}</span></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Maintenance blocks</p>
            {data.maintenanceBlocks.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="space-y-1 text-sm">
                {[...data.maintenanceBlocks].sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2"><span><span className="font-mono text-xs">{data.routes.find((r) => r.id === m.routeId)?.code}</span> · {formatDate(m.date)} · {m.reason}</span>
                    {isSA && <Button size="sm" variant="ghost" onClick={() => run((d) => removeMaintenanceBlock(d, m.id, actor), 'Maintenance block removed.')}>Remove</Button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <CapacityDialog open={dialog === 'capacity'} routes={data.routes} current={(id) => data.capacity.find((c) => c.routeId === id)?.dailyUnits} onClose={() => setDialog(null)}
        onSubmit={(routeId, units) => run((d) => setRouteCapacity(d, routeId, units, actor), 'Daily capacity saved. It applies to new bookings; existing bookings are not cancelled.')} />
      <MaintenanceDialog open={dialog === 'maintenance'} routes={data.routes} onClose={() => setDialog(null)}
        onSubmit={(v) => run((d) => addMaintenanceBlock(d, v, actor), 'Maintenance block added.')} />
      <RateDialog open={dialog === 'rate'} routes={data.routes} onClose={() => setDialog(null)}
        onSubmit={(v) => run((d) => insertFreightRate(d, v, actor), 'Freight rate added. Earlier rows are retained and bookings with a frozen price are unchanged.')} />
      <RouteDialog open={dialog === 'route'} onClose={() => setDialog(null)}
        onSubmit={(v) => run((d) => addRoute(d, v, actor), 'Route added. Add rates before it can be booked.')} />
      <ConfigDialog open={dialog === 'config'} config={data.config} onClose={() => setDialog(null)}
        onSubmit={(c, reason) => run((d) => updateConfig(d, c, actor, new Date().toISOString(), reason), 'Configuration saved. Frozen booking prices are unchanged.')} />
    </>
  )
}
