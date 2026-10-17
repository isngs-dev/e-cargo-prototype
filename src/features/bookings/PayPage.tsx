import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Banknote, Building2, CircleCheck, CircleX, Clock, CreditCard, Landmark, Lock, Smartphone } from 'lucide-react'
import { useStore } from '@/app/store'
import { visibleBookings } from '@/app/selectors'
import { Notice } from '@/components/ui/blocks'
import { Button, Card } from '@/components/ui/primitives'
import { bookingStatusMeta } from '@/lib/status'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { settleCredit, simulatePayment } from '@/lib/workflow/payment'
import type { Actor } from '@/lib/workflow/result'
import type { Booking } from '@/types/domain'
import { cn } from '@/lib/cn'

type Stage = 'summary' | 'details' | 'processing' | 'success' | 'failed' | 'pending'

const SIM = 'Simulated payment page — no bank or payment gateway (Paystack) is contacted and no money moves.'

/** What this page would pay: a Director-approved pay-now invoice, or a credit balance whose payment link has been issued. */
function payable(b: Booking): 'invoice' | 'credit' | null {
  if (!b.approved) return null
  if (b.status === 'awaiting_payment' && b.payment.status !== 'processing') return 'invoice'
  if (b.payment.status === 'credit_outstanding' && b.payment.linkIssuedAt) return 'credit'
  return null
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Lock className="size-3.5" aria-hidden /> Secure payment · simulated</span>
        <span>NRC e-Cargo</span>
      </div>
      {children}
      <p className="mt-4 text-center text-xs text-slate-400">{SIM}</p>
    </div>
  )
}

function Row({ k, v, mono = false, strong = false }: { k: string; v: ReactNode; mono?: boolean; strong?: boolean }) {
  return <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-slate-500">{k}</dt><dd className={cn('text-right text-slate-900', mono && 'font-mono text-xs', strong && 'text-base font-semibold tabular-nums')}>{v}</dd></div>
}

export function PayPage() {
  const { id } = useParams()
  const { data, persona, act } = useStore()
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('summary')
  const [error, setError] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const booking = data.bookings.find((b) => b.id === id)
  const allowed = booking && persona.role === 'cargo_facilitator' && visibleBookings(data, persona).some((b) => b.id === booking.id)
  if (!booking || !allowed) {
    return <Notice tone="warning" title="Payment not available">Only the booking’s own facilitator can pay it. <Link to="/bookings" className="underline">Back to bookings</Link></Notice>
  }
  const b = booking
  const total = b.approved ? formatKobo(b.approved.price.totalPayable) : '—'
  const kind = payable(b)
  const actor: Actor = { name: persona.name, role: persona.role, customerId: persona.customerId }
  const back = (flash?: string) => navigate(`/bookings/${b.id}`, { state: flash ? { flash } : undefined })
  const reference = b.payment.reference ?? `DEMO-PSK-${b.reference.slice(-4)}`

  const start = (o: 'success' | 'failure' | 'pending') => {
    setStage('processing')
    setError('')
    timer.current = window.setTimeout(() => {
      const r = act((d) => (kind === 'credit' ? settleCredit(d, b.id, o === 'pending' ? 'failure' : o, actor) : simulatePayment(d, b.id, o, actor)))
      if (!r.ok) { setError(r.error); setStage('details'); return }
      setStage(o === 'success' ? 'success' : o === 'failure' ? 'failed' : 'pending')
    }, 2400)
  }

  // Refreshed or revisited after payment: show the saved result.
  const received = b.payment.status === 'paid' || b.payment.status === 'credit_settled'
  if (stage === 'summary' && !kind) {
    if (received) {
      return (
        <Shell>
          <Card className="p-8 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CircleCheck className="size-9" aria-hidden /></span>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Payment received</h1>
            <p className="mt-1 text-sm text-slate-500">{b.reference} has already been paid.</p>
            <dl className="mt-5 divide-y divide-slate-100 text-left"><Row k="Amount" v={total} strong /><Row k="Reference" v={b.payment.reference ?? reference} mono />{b.payment.paidAt && <Row k="Paid" v={formatDateTime(b.payment.paidAt)} />}<Row k="Booking status" v={bookingStatusMeta[b.status].label} /></dl>
            <Button className="mt-6 w-full" onClick={() => back()}>Back to booking</Button>
          </Card>
        </Shell>
      )
    }
    return (
      <Shell>
        <Notice tone="warning" title="Nothing to pay right now">{b.payment.status === 'processing' ? 'A payment is already being confirmed (simulated).' : b.status === 'awaiting_payment' ? 'This booking is not ready for payment.' : 'This booking is not awaiting payment.'} <Link to={`/bookings/${b.id}`} className="underline">Back to booking</Link></Notice>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{kind === 'credit' ? 'Credit balance' : 'Invoice'} {b.payment.invoiceNumber ?? ''}</p>
            <p className="text-sm font-medium text-slate-900">{b.reference}</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{total}</p>
        </div>

        {stage === 'summary' && (
          <div className="space-y-4 p-6">
            <h1 className="text-lg font-semibold text-slate-900">Choose how to pay</h1>
            <ul className="space-y-2">
              <li><button type="button" onClick={() => setStage('details')} className="flex w-full items-center gap-3 rounded-lg border-2 border-brand-600 bg-brand-50 px-4 py-3 text-left" aria-label="Pay via bank transfer">
                <span className="flex size-9 items-center justify-center rounded-md bg-white text-brand-700"><Landmark className="size-5" aria-hidden /></span>
                <span className="flex-1"><span className="block text-sm font-semibold text-slate-900">Pay via bank transfer</span><span className="block text-xs text-slate-600">Transfer the exact amount from your bank</span></span>
              </button></li>
              {[{ icon: CreditCard, name: 'Card' }, { icon: Smartphone, name: 'USSD' }].map(({ icon: I, name }) => (
                <li key={name}><div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 opacity-50"><span className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-500"><I className="size-5" aria-hidden /></span><span className="text-sm text-slate-700">{name} <span className="text-xs text-slate-500">— not available in the demo</span></span></div></li>
              ))}
            </ul>
            <Button className="h-10 w-full" onClick={() => setStage('details')}>Pay via bank transfer</Button>
            <button type="button" onClick={() => back()} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> Back to booking</button>
          </div>
        )}

        {stage === 'details' && (
          <div className="space-y-4 p-6">
            <h1 className="text-lg font-semibold text-slate-900">Bank transfer details</h1>
            <p className="text-sm text-slate-600">Transfer exactly <strong>{total}</strong> to the account below, then confirm. <span className="text-slate-500">(Fake account for the demonstration.)</span></p>
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-4">
              <Row k="Bank" v={<span className="inline-flex items-center gap-1.5"><Building2 className="size-4 text-slate-400" aria-hidden /> Demo Bank Plc</span>} />
              <Row k="Account name" v="NRC e-Cargo Collections (demo)" />
              <Row k="Account number" v="0123456789" mono />
              <Row k="Amount" v={total} strong />
              <Row k="Payment reference" v={reference} mono />
            </dl>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button className="h-10 w-full" onClick={() => start('success')}><Banknote className="size-4" /> Confirm payment</Button>
            <button type="button" onClick={() => setStage('summary')} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> Choose another method</button>
            <div className="border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">
              Presenter options:{' '}
              <button type="button" onClick={() => start('failure')} className="underline hover:text-slate-800">simulate a failed transfer</button>{' · '}
              <button type="button" onClick={() => start('pending')} className="underline hover:text-slate-800">simulate a transfer that stays pending</button>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex flex-col items-center px-6 py-14 text-center" role="status" aria-live="polite">
            <span className="size-16 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" aria-hidden />
            <h1 className="mt-6 text-lg font-semibold text-slate-900">Confirming your transfer…</h1>
            <p className="mt-1 text-sm text-slate-500">Please wait. Do not close this page.</p>
          </div>
        )}

        {stage === 'success' && (
          <div className="px-6 py-10 text-center" role="status">
            <span className="pay-pop mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg viewBox="0 0 24 24" className="size-11" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path className="pay-tick" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <h1 className="mt-5 text-xl font-semibold text-slate-900">Payment successful</h1>
            <p className="mt-1 text-sm text-slate-500">{kind === 'credit' ? 'Your credit balance has been settled.' : 'Your booking is now released to the port.'} (Simulated)</p>
            <dl className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 px-4 text-left">
              <Row k="Amount paid" v={total} strong /><Row k="Reference" v={reference} mono /><Row k="Booking" v={b.reference} />
              <Row k="Booking status" v={bookingStatusMeta[b.status].label} />
            </dl>
            <Button className="mt-6 h-10 w-full" onClick={() => back(`Payment of ${total} confirmed (simulated). Booking status: ${bookingStatusMeta[b.status].label}.`)}>Back to booking</Button>
          </div>
        )}

        {stage === 'failed' && (
          <div className="px-6 py-10 text-center" role="status">
            <span className="pay-pop mx-auto flex size-20 items-center justify-center rounded-full bg-red-100 text-red-600"><CircleX className="size-11" aria-hidden /></span>
            <h1 className="mt-5 text-xl font-semibold text-slate-900">Payment failed</h1>
            <p className="mt-1 text-sm text-slate-500">The transfer could not be confirmed (simulated). Your booking is unchanged and you can try again.</p>
            <div className="mt-6 flex gap-2"><Button className="h-10 flex-1" onClick={() => setStage('details')}>Try again</Button><Button variant="secondary" className="h-10 flex-1" onClick={() => back()}>Back to booking</Button></div>
          </div>
        )}

        {stage === 'pending' && (
          <div className="px-6 py-10 text-center" role="status">
            <span className="pay-pop mx-auto flex size-20 items-center justify-center rounded-full bg-sky-100 text-sky-600"><Clock className="size-11" aria-hidden /></span>
            <h1 className="mt-5 text-xl font-semibold text-slate-900">Transfer submitted</h1>
            <p className="mt-1 text-sm text-slate-500">We are waiting for the bank to confirm (simulated). Super Admin reconciles it; your booking stays awaiting payment until then.</p>
            <Button className="mt-6 h-10 w-full" onClick={() => back('Payment submitted — awaiting confirmation (simulated).')}>Back to booking</Button>
          </div>
        )}
      </Card>
    </Shell>
  )
}
