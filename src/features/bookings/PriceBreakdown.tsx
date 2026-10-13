import { Card, CardHeader, Badge } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatBp, formatKobo } from '@/lib/money'
import type { PriceBreakdown as Price } from '@/types/domain'

/**
 * Pricing breakdown with every component, rate and assumption visible.
 * `showDiscount` is false for Non-Priority customers — no discount line is displayed for them (baseline §4.1).
 */
export function PriceBreakdown({
  price, showDiscount, mode, error,
}: { price?: Price; showDiscount: boolean; mode: 'indicative' | 'frozen' | 'preview'; error?: string }) {
  return (
    <Card>
      <CardHeader
        title={mode === 'frozen' ? 'Approved price' : mode === 'preview' ? 'Price on approval' : 'Price breakdown'}
        action={<Badge tone={mode === 'frozen' ? 'success' : 'info'}>{mode === 'frozen' ? 'Frozen at approval' : mode === 'preview' ? 'Preview — not yet frozen' : 'Indicative'}</Badge>}
      />
      {error || !price ? (
        <p role="alert" className="px-5 py-4 text-sm text-red-700">{error ?? 'Complete the shipment details to see the price.'}</p>
      ) : (
        <div className="px-5 py-4 text-sm">
          <ul className="space-y-1 text-xs text-slate-600">
            {price.lines.map((l) => (
              <li key={l.containerType} className="flex justify-between gap-3">
                <span>{l.quantity} × {l.containerType} @ {formatKobo(l.ratePerUnit)}</span>
                <span className="tabular-nums">{formatKobo(l.amount)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            <Row label="Base freight" value={formatKobo(price.baseFreight)} />
            {showDiscount && price.discountBp > 0 && <Row label={`Less: ${mode === 'indicative' ? 'Indicative' : 'Approved'} discount (${formatBp(price.discountBp)})`} value={`−${formatKobo(price.discount)}`} tone="text-emerald-700" />}
            {showDiscount && price.discountBp > 0 && <Row label="Net freight" value={formatKobo(price.netFreight)} />}
            <Row label={`VAT (${formatBp(price.rates.vatBp)})`} value={formatKobo(price.vat)} />
            <Row label={`Stamp duty (${formatBp(price.rates.stampDutyBp)})`} value={formatKobo(price.stampDuty)} />
            <Row label={`Goods in transit insurance (${formatBp(price.rates.insuranceBp)})`} value={formatKobo(price.insurance)} />
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <dt>Total payable</dt>
              <dd className="tabular-nums">{formatKobo(price.totalPayable)}</dd>
            </div>
          </dl>
          <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-slate-500">
            <li>
              VAT, stamp duty and insurance are calculated on {price.taxBasis === 'net' ? 'net freight (after discount)' : 'gross freight (before discount)'} — basis pending NRC confirmation.
            </li>
            {mode === 'preview' ? (
              <li>Preview of the price that will be frozen when you approve.</li>
            ) : mode === 'indicative' ? (
              <>
                {showDiscount && <li>The discount shown is indicative. The Director may reduce it at approval, never increase it.</li>}
                <li>No payment is taken now. Payment happens only after Director approval.</li>
              </>
            ) : (
              <li>Calculated once at Director approval; later rate or eligibility changes do not alter it.</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={cn('flex justify-between gap-3', tone)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
