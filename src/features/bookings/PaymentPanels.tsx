import { BellRing, Clock, CreditCard, Landmark, TimerOff } from 'lucide-react'
import { Notice, PaymentStatusBadge } from '@/components/ui/blocks'
import { Button, Card, CardHeader } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { autoCancelUnpaid, issueCreditPaymentLink, reconcilePayment, sendPaymentReminder, settleCredit, simulatePayment } from '@/lib/workflow/payment'
import type { Actor } from '@/lib/workflow/result'
import type { Booking } from '@/types/domain'
import type { Run } from './runTypes'

const SIM = 'Simulated — the payment gateway (Paystack) is never contacted and no money moves.'

/** Facilitator: pay the simulated payment link, or settle credit when the credit period has ended. */
export function FacilitatorPaymentPanel({ booking, actor, run }: { booking: Booking; actor: Actor; run: Run }) {
  const b = booking
  if (!b.approved) return null
  const total = formatKobo(b.approved.price.totalPayable)

  if (b.status === 'awaiting_payment') {
    const processing = b.payment.status === 'processing'
    return (
      <Card>
        <CardHeader title="Payment due" description="Payment link issued after Director approval" action={<PaymentStatusBadge status={b.payment.status} />} />
        <div className="space-y-3 p-5 text-sm">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Invoice</dt><dd className="font-mono text-xs">{b.payment.invoiceNumber}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Amount</dt><dd className="font-semibold tabular-nums">{total}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Pay by</dt><dd>{b.payment.dueBy ? formatDateTime(b.payment.dueBy) : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Payment link</dt><dd className="break-all font-mono text-xs">demo://paystack/pay/{b.payment.reference}</dd></div>
          </dl>
          {b.payment.reminderSentAt && <Notice title="Reminder sent">A 24-hour reminder email was sent on {formatDateTime(b.payment.reminderSentAt)} (simulated).</Notice>}
          {b.payment.status === 'failed' && <Notice tone="warning" title="Last payment attempt failed (simulated)">The link is still valid until the payment window elapses. You can try again.</Notice>}
          {processing ? (
            <Notice title="Payment processing (simulated)">Waiting for gateway confirmation. Super Admin reconciles it (simulated webhook).</Notice>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Choose a simulated outcome</p>
              <Button className="w-full" onClick={() => run((d) => simulatePayment(d, b.id, 'success', actor), 'Payment confirmed (simulated). The booking is now pending dispatch.')}><CreditCard className="size-4" /> Pay successfully</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => run((d) => simulatePayment(d, b.id, 'failure', actor), 'Payment failed (simulated).')}>Payment fails</Button>
                <Button variant="secondary" onClick={() => run((d) => simulatePayment(d, b.id, 'pending', actor), 'Payment submitted — awaiting confirmation (simulated).')}>Stays pending</Button>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">{SIM}</p>
        </div>
      </Card>
    )
  }

  if (b.payment.status === 'credit_outstanding') {
    return (
      <Card>
        <CardHeader title="Credit terms" description={`${b.approved.creditMonths}-month credit approved`} action={<PaymentStatusBadge status={b.payment.status} />} />
        <div className="space-y-3 p-5 text-sm">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Invoice</dt><dd className="font-mono text-xs">{b.payment.invoiceNumber ?? '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Balance</dt><dd className="font-semibold tabular-nums">{total}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Credit period ends</dt><dd>{b.payment.dueBy ? formatDateTime(b.payment.dueBy) : '—'}</dd></div>
          </dl>
          {b.payment.linkIssuedAt ? (
            <div className="space-y-2">
              <Notice title="Payment link issued">The credit period has ended. Pay the balance below (simulated).</Notice>
              <Button className="w-full" onClick={() => run((d) => settleCredit(d, b.id, 'success', actor), 'Credit balance settled (simulated).')}><CreditCard className="size-4" /> Settle balance</Button>
              <Button className="w-full" variant="secondary" onClick={() => run((d) => settleCredit(d, b.id, 'failure', actor), 'Settlement attempt failed (simulated).')}>Settlement fails</Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Your booking proceeds without immediate payment. The payment link is issued at the end of the credit period.</p>
          )}
          <p className="text-xs text-slate-500">{SIM}</p>
        </div>
      </Card>
    )
  }
  return null
}

/** Super Admin: reconciliation and demo time controls. Clearly labelled as demo-only. */
export function SuperAdminPaymentControls({ booking, actor, run }: { booking: Booking; actor: Actor; run: Run }) {
  const b = booking
  const awaiting = b.status === 'awaiting_payment'
  const creditOpen = b.payment.status === 'credit_outstanding' && !b.payment.linkIssuedAt
  if (!awaiting && !creditOpen) return null
  return (
    <Card className="border-dashed">
      <CardHeader title="Demo controls (Super Admin)" description="Stand-ins for system events and the payment webhook. Demo only." />
      <div className="space-y-2 p-5">
        {awaiting && b.payment.status === 'processing' && (
          <>
            <Button className="w-full" onClick={() => run((d) => reconcilePayment(d, b.id, 'confirm', actor), 'Payment reconciled and confirmed (simulated webhook).')}><Landmark className="size-4" /> Reconcile — payment received</Button>
            <Button className="w-full" variant="secondary" onClick={() => run((d) => reconcilePayment(d, b.id, 'fail', actor), 'Reconciliation: payment not received (simulated).')}>Reconcile — not received</Button>
          </>
        )}
        {awaiting && b.payment.status !== 'processing' && (
          <>
            <Button className="w-full" variant="secondary" onClick={() => run((d) => sendPaymentReminder(d, b.id, actor), '24-hour payment reminder sent (simulated).')}><BellRing className="size-4" /> Send 24h reminder</Button>
            <Button className="w-full" variant="secondary" onClick={() => run((d) => autoCancelUnpaid(d, b.id, actor), 'Booking auto-cancelled — payment window elapsed (simulated).')}><TimerOff className="size-4" /> Payment window elapses → auto-cancel</Button>
          </>
        )}
        {creditOpen && <Button className="w-full" variant="secondary" onClick={() => run((d) => issueCreditPaymentLink(d, b.id, actor), 'Credit period ended — payment link issued (simulated).')}><Clock className="size-4" /> Credit period ends → issue payment link</Button>}
      </div>
    </Card>
  )
}
