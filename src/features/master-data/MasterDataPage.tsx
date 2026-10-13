import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Badge, Card, CardHeader, Table, Td, Th } from '@/components/ui/primitives'
import { findRate } from '@/lib/pricing'
import { formatDate } from '@/lib/format'
import { formatBp, formatKobo } from '@/lib/money'
import type { CargoType, ContainerType } from '@/types/domain'

const columns: [CargoType, ContainerType][] = [
  ['Containerized', '20ft'],
  ['Containerized', '40ft'],
  ['Containerized', 'Reefer'],
  ['Non-Containerized', 'Wagon'],
]

export function MasterDataPage() {
  const { data, persona } = useStore()
  const today = new Date().toISOString().slice(0, 10)
  const { tax } = data.config
  return (
    <>
      <PageHeader title="Routes & freight rates" description="Route & Freight Rate Master. Rates are illustrative demo values, not NRC tariffs." />
      <div className="mb-4">
        <Notice title={persona.role === 'super_admin' ? 'Read-only in this phase' : 'View only'}>
          {persona.role === 'super_admin'
            ? 'Effective-dated rate maintenance (insert-only) arrives in Phase 7.'
            : 'The Director can view master data; only Super Admin configures it.'}
        </Notice>
      </div>
      <Card>
        <CardHeader title="Current rate per unit" description={`Rate in force today (${formatDate(today)}). Containerized rates are per container; non-containerized per wagon (demo assumption).`} />
        <Table>
          <thead>
            <tr>
              <Th>Route</Th>
              {columns.map(([c, t]) => <Th key={t} className="text-right">{c === 'Containerized' ? t : 'Non-cont. / wagon'}</Th>)}
            </tr>
          </thead>
          <tbody>
            {data.routes.map((r) => (
              <tr key={r.id}>
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
                  <Td className="text-xs">{formatDate(fr.effectiveFrom)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Taxes & levies" description="Applied after discount" />
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['VAT', formatBp(tax.vatBp)],
              ['Stamp Duty', formatBp(tax.stampDutyBp)],
              ['Goods in Transit Insurance', formatBp(tax.insuranceBp)],
              ['Tax basis', tax.basis === 'net' ? 'Net freight (after discount)' : 'Gross freight (before discount)'],
              ['Payment window (unpaid auto-cancel)', `${data.config.paymentWindowHours} hours`],
              ['Payment reminder', `${data.config.paymentReminderHours} hours`],
              ['Refund request window', `${data.config.refundWindowDays} days`],
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
    </>
  )
}
