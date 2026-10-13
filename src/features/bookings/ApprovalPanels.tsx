import { useMemo, useState } from 'react'
import { CircleCheck, Send, Undo2, X } from 'lucide-react'
import { Field, Textarea } from '@/components/ui/fields'
import { Badge, Button, Card, CardHeader, Input } from '@/components/ui/primitives'
import { ReasonDialog } from '@/features/registrations/ReasonDialog'
import { allowedPaymentTerms, discountReductionNeedsReason } from '@/lib/eligibility'
import { formatBp } from '@/lib/money'
import { tryCalculatePrice } from '@/lib/pricing'
import {
  directorApproveBooking, directorRejectBooking, directorSendBackBooking, hocApproveBooking, hocRejectBooking, hocSendBackBooking,
  type DirectorDecision,
} from '@/lib/workflow/bookingApproval'
import type { Actor } from '@/lib/workflow/result'
import type { AppData, Booking, Customer, PaymentTerms } from '@/types/domain'
import { PriceBreakdown } from './PriceBreakdown'
import type { Run } from './runTypes'

type Dlg = null | 'back' | 'reject' | 'approve'

export function HeadOfCargoPanel({ booking, actor, run }: { booking: Booking; actor: Actor; run: Run }) {
  const [dialog, setDialog] = useState<Dlg>(null)
  return (
    <Card>
      <CardHeader title="Cargo review" description="Do the documents and cargo details check out? Discount and payment terms are set by the Director." />
      <div className="space-y-3 p-5">
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
          <li>Document completeness and validity</li>
          <li>Container / wagon details, weight and cargo declaration</li>
          {booking.hazardous && <li className="font-medium text-amber-800">Hazardous compliance documentation</li>}
        </ul>
        <Button className="w-full" onClick={() => setDialog('approve')}><Send className="size-4" /> Verified — forward to Director</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setDialog('back')}><Undo2 className="size-4" /> Send back</Button>
          <Button variant="danger" onClick={() => setDialog('reject')}><X className="size-4" /> Reject</Button>
        </div>
      </div>
      <ReasonDialog open={dialog === 'approve'} onClose={() => setDialog(null)} title="Forward to Director" description="Confirm the documents, containers/wagons and cargo declaration are verified." label="Remarks (optional)" required={false} confirmLabel="Forward"
        onConfirm={(r) => run((d) => hocApproveBooking(d, booking.id, actor, r), 'Booking verified and forwarded to the Director.')} />
      <ReasonDialog open={dialog === 'back'} onClose={() => setDialog(null)} title="Send back to facilitator" description="The facilitator sees your comments and can correct and resubmit (email simulated)." label="Comments for the facilitator" confirmLabel="Send back"
        onConfirm={(r) => run((d) => hocSendBackBooking(d, booking.id, actor, r), 'Booking sent back to the facilitator (email simulated).')} />
      <ReasonDialog open={dialog === 'reject'} onClose={() => setDialog(null)} title="Reject booking" description="No payment has been taken, so no refund is required (email simulated)." label="Reason for rejection" confirmLabel="Reject booking" danger
        onConfirm={(r) => run((d) => hocRejectBooking(d, booking.id, actor, r), 'Booking rejected (email simulated).')} />
    </Card>
  )
}

export function DirectorPanel({ booking, customer, data, actor, run }: { booking: Booking; customer: Customer; data: AppData; actor: Actor; run: Run }) {
  const e = customer.eligibility
  const terms = allowedPaymentTerms(e)
  const maxPct = e.isPriority ? e.eligibleDiscountBp / 100 : 0
  const [discount, setDiscount] = useState(String(maxPct))
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('pay_now')
  const [creditMonths, setCreditMonths] = useState('1')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<Dlg>(null)

  const pct = discount === '' ? NaN : Number(discount)
  const bp = Math.round(pct * 100)
  const needsReason = Number.isFinite(pct) && discountReductionNeedsReason(e, bp)
  const preview = useMemo(
    () => (Number.isFinite(pct) && bp >= 0 && bp <= 10_000
      ? tryCalculatePrice({ routeId: booking.routeId, cargoType: booking.cargoType, containers: booking.containers, bookingDate: booking.bookingDate, discountBp: bp }, data.freightRates, data.config.tax)
      : ({ ok: false, error: 'Enter a valid discount.' } as const)),
    [pct, bp, booking, data.freightRates, data.config.tax],
  )

  const decision = (): DirectorDecision => ({
    discountPct: pct, paymentTerms, creditMonths: paymentTerms === 'pay_after_credit' ? Number(creditMonths) : 0, reason, remarks,
  })
  const approve = () => {
    const err = run((d) => directorApproveBooking(d, booking.id, actor, decision()), 'Booking approved. Price frozen; invoice generated and payment terms applied (simulated — no payment gateway contacted).')
    if (err) setError(err)
  }

  return (
    <>
      <PriceBreakdown price={preview.ok ? preview.price : undefined} error={preview.ok ? undefined : preview.error} showDiscount={e.isPriority} mode="preview" />
      <Card>
        <CardHeader title="Final decision" description="Set the final discount and payment terms, then approve." />
        <div className="space-y-4 p-5">
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">{customer.companyName} <Badge tone={e.isPriority ? 'success' : 'neutral'}>{e.isPriority ? 'Priority' : 'Non-Priority'}</Badge></p>
            {e.isPriority ? (
              <p className="text-xs text-slate-600">Eligible discount up to <strong>{formatBp(e.eligibleDiscountBp)}</strong> · credit up to <strong>{e.eligibleCreditMonths} month{e.eligibleCreditMonths === 1 ? '' : 's'}</strong></p>
            ) : (
              <p className="text-xs text-slate-600">No discount or credit eligibility — payment link now only.</p>
            )}
          </div>

          <Field label="Final discount (%)" hint={e.isPriority ? `You may grant less than ${formatBp(e.eligibleDiscountBp)}, never more.` : 'Not available — no discount can be granted to a Non-Priority customer.'}>
            <Input type="number" min={0} max={maxPct} step={0.5} disabled={!e.isPriority} value={e.isPriority ? discount : 0} onChange={(ev) => { setDiscount(ev.target.value); setError('') }} />
          </Field>
          {needsReason && (
            <Field label="Reason for granting less than the eligible maximum" required>
              <Textarea value={reason} onChange={(ev) => { setReason(ev.target.value); setError('') }} />
            </Field>
          )}

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-800">Payment terms</legend>
            <div className="space-y-2">
              {(['pay_now', 'pay_after_credit'] as const).map((t) => {
                const enabled = terms.includes(t)
                return (
                  <label key={t} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${paymentTerms === t ? 'border-brand-600 bg-brand-50' : 'border-slate-300'} ${enabled ? 'cursor-pointer' : 'opacity-50'}`}>
                    <input type="radio" name="terms" className="accent-brand-600" disabled={!enabled} checked={paymentTerms === t} onChange={() => { setPaymentTerms(t); setError('') }} />
                    {t === 'pay_now' ? 'Payment link now' : 'Payment link after credit period'}
                    {!enabled && <span className="text-xs text-slate-500">(not available)</span>}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {paymentTerms === 'pay_after_credit' && (
            <Field label="Credit period (months)" hint={`Up to ${e.eligibleCreditMonths}.`}>
              <Input type="number" min={1} max={e.eligibleCreditMonths} step={1} value={creditMonths} onChange={(ev) => { setCreditMonths(ev.target.value); setError('') }} />
            </Field>
          )}
          <Field label="Remarks (optional)"><Textarea value={remarks} onChange={(ev) => setRemarks(ev.target.value)} /></Field>

          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button className="w-full" onClick={approve} disabled={!preview.ok}><CircleCheck className="size-4" /> Approve & freeze price</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDialog('back')}><Undo2 className="size-4" /> Send back</Button>
            <Button variant="danger" onClick={() => setDialog('reject')}><X className="size-4" /> Reject</Button>
          </div>
        </div>
      </Card>
      <ReasonDialog open={dialog === 'back'} onClose={() => setDialog(null)} title="Send back to Head of Cargo" label="Reason" confirmLabel="Send back"
        onConfirm={(r) => run((d) => directorSendBackBooking(d, booking.id, actor, r), 'Booking sent back to the Head of Cargo.')} />
      <ReasonDialog open={dialog === 'reject'} onClose={() => setDialog(null)} title="Reject booking" description="No payment has been taken, so no refund is required (email simulated)." label="Reason for rejection" confirmLabel="Reject booking" danger
        onConfirm={(r) => run((d) => directorRejectBooking(d, booking.id, actor, r), 'Booking rejected (email simulated).')} />
    </>
  )
}
