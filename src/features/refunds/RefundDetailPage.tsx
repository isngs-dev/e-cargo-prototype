import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CircleCheck, Landmark, Search, Send, Undo2 } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName } from '@/app/selectors'
import { Flash, Notice, PageHeader } from '@/components/ui/blocks'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/fields'
import { Badge, Button, Card, CardHeader, Input } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { StageTracker } from '@/features/audit/Timeline'
import { ReasonDialog } from '@/features/registrations/ReasonDialog'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { advanceRefund, refundSteps, reverseRefund, submitRefundRequest, triggerRefund } from '@/lib/workflow/refund'
import type { Actor } from '@/lib/workflow/result'
import type { Refund } from '@/types/domain'
import { refundActionHint, refundTone } from './refundUi'

/** One refund: summary, progress, the role's actions, request details, reversal and history. */
export function RefundDetailPage() {
  const { id } = useParams()
  const { data, persona, act } = useStore()
  const [flash, setFlash] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [reversing, setReversing] = useState(false)

  const refund = data.refunds.find((r) => r.id === id)
  const isFac = persona.role === 'cargo_facilitator'
  if (!refund || (isFac && refund.customerId !== persona.customerId)) {
    return <Notice tone="warning" title="Refund not available">It does not exist, was removed by “Reset demo”, or is not visible to your role. <Link to="/refunds" className="underline">Back to refunds</Link></Notice>
  }

  const actor: Actor = { name: persona.name, role: persona.role, customerId: persona.customerId }
  const isDir = persona.role === 'director_operations'
  const isSA = persona.role === 'super_admin'
  const booking = data.bookings.find((b) => b.id === refund.bookingId)
  const at = refundSteps.findIndex((s) => s.status === refund.status)
  const reversal = data.refundReversals.find((r) => r.refundId === refund.id)
  const history = data.audit.filter((e) => e.entityType === 'refund' && e.entityId === refund.id).slice().reverse()
  const hint = refundActionHint(persona.role, refund.status)

  const run = (fn: Parameters<typeof act>[0], msg: string): string | null => {
    const r = act(fn)
    if (!r.ok) { setFlash(`Not done: ${r.error}`); return r.error }
    setFlash(msg)
    return null
  }

  return (
    <>
      <Link to="/refunds" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> All refunds</Link>
      <PageHeader
        title={`Refund · ${booking?.reference ?? refund.bookingId}`}
        description={<span className="inline-flex flex-wrap items-center gap-2">{customerName(data, refund.customerId)} <span className="font-semibold tabular-nums text-slate-800">{formatKobo(refund.amount)}</span> <Badge tone={refundTone(refund.status)}>{refundSteps[at]?.label}</Badge>{reversal && <Badge tone="danger">Reversed</Badge>}</span>}
      />
      <Flash message={flash} onDismiss={() => setFlash(null)} />
      <Notice title="Simulated refund">No bank is contacted and no money moves. Only a masked account reference is kept.</Notice>

      <Card className="my-6 p-5"><StageTracker steps={refundSteps.map((s) => s.label)} at={refund.status === 'processed' ? refundSteps.length : at} label="Refund progress" /></Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Refund details" />
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Booking</dt><dd className="font-medium"><Link to={`/bookings/${refund.bookingId}`} className="font-mono text-brand-700 hover:underline">{booking?.reference ?? refund.bookingId}</Link></dd></div>
              <div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-medium tabular-nums">{formatKobo(refund.amount)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Reason</dt><dd className="font-medium">{refund.reason}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd className="font-medium">{formatDateTime(refund.createdAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Refund link sent</dt><dd className="font-medium">{refund.linkSentAt ? formatDateTime(refund.linkSentAt) : '—'}</dd></div>
            </dl>
          </Card>

          {refund.request && (
            <Card>
              <CardHeader title="Facilitator’s request" description="Simulated bank details — only a masked reference is kept." />
              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Bank (simulated)</dt><dd className="font-medium">{refund.request.bankName}</dd></div>
                <div><dt className="text-xs text-slate-500">Account</dt><dd className="font-medium">{refund.request.accountName} {refund.request.accountMask}</dd></div>
                <div><dt className="text-xs text-slate-500">Confirmed amount</dt><dd className="font-medium tabular-nums">{formatKobo(refund.request.confirmedAmount)}</dd></div>
                <div><dt className="text-xs text-slate-500">Policy acknowledged</dt><dd className="font-medium">{refund.request.policyAcknowledged ? 'Yes' : 'No'}</dd></div>
                <div><dt className="text-xs text-slate-500">Requested</dt><dd className="font-medium">{formatDateTime(refund.request.requestedAt)}</dd></div>
              </dl>
            </Card>
          )}

          {refund.processedAt && (
            <Card>
              <CardHeader title="Disbursement" description="Simulated — no gateway was contacted." />
              <p className="px-5 py-4 text-sm text-emerald-800">Processed {formatDateTime(refund.processedAt)} · reference <span className="font-mono">{refund.reference}</span></p>
            </Card>
          )}

          {reversal && (
            <Card className="border-red-200">
              <CardHeader title="Reversed" description="The original refund record above is unchanged; this separate entry reverses it." />
              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Reason</dt><dd className="font-medium">{reversal.reason}</dd></div>
                <div><dt className="text-xs text-slate-500">Reversal reference</dt><dd className="font-mono text-xs">{reversal.reference}</dd></div>
                <div><dt className="text-xs text-slate-500">By</dt><dd className="font-medium">{reversal.byName}</dd></div>
                <div><dt className="text-xs text-slate-500">When</dt><dd className="font-medium">{formatDateTime(reversal.at)}</dd></div>
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Action" description={hint ? hint.replace('Your action: ', 'Next: ') : 'Nothing is needed from you on this refund.'} />
            <div className="space-y-2 p-5">
              {isDir && refund.status === 'awaiting_director' && <Button className="w-full" onClick={() => run((d) => triggerRefund(d, refund.id, actor), 'Refund link triggered. The facilitator receives the rejection reason and the request form (email simulated).')}><Send className="size-4" /> Trigger refund link</Button>}
              {isFac && refund.status === 'link_sent' && <Button className="w-full" onClick={() => setRequesting(true)}><Landmark className="size-4" /> Submit refund request</Button>}
              {isSA && refund.status === 'requested' && <Button className="w-full" onClick={() => run((d) => advanceRefund(d, refund.id, 'review', actor), 'Verification started — the refund is under review.')}><Search className="size-4" /> Start review</Button>}
              {isSA && refund.status === 'under_review' && <Button className="w-full" onClick={() => run((d) => advanceRefund(d, refund.id, 'approve', actor), 'Refund verified and approved.')}><CircleCheck className="size-4" /> Approve refund</Button>}
              {isSA && refund.status === 'approved' && <Button className="w-full" onClick={() => run((d) => advanceRefund(d, refund.id, 'process', actor), 'Refund processed (simulated Paystack — no money moved). The customer is notified (simulated).')}><Landmark className="size-4" /> Process refund (simulated)</Button>}
              {isSA && refund.status === 'processed' && !reversal && <Button className="w-full" variant="danger" onClick={() => setReversing(true)}><Undo2 className="size-4" /> Reverse this refund</Button>}
              {!hint && !(isSA && refund.status === 'processed' && !reversal) && <p className="text-sm text-slate-500">{refund.status === 'processed' ? 'This refund is complete.' : 'Waiting on another role.'}</p>}
            </div>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">The Director triggers; Super Admin processes. Two parties are involved in every money movement.</p>
          </Card>
          <Card><CardHeader title="History" description="Actor, time and status change" /><ActivityList entries={history} /></Card>
        </div>
      </div>

      <RefundRequestDialog refund={requesting ? refund : null} onClose={() => setRequesting(false)} onSubmit={(input) => {
        const r = act((d) => submitRefundRequest(d, refund.id, input, actor))
        if (!r.ok) return r.error
        setFlash('Refund request submitted. Super Admin will verify it (simulated).')
        return null
      }} />
      <ReasonDialog open={reversing} onClose={() => setReversing(false)} danger title="Reverse this refund" description="Adds a reversing entry (simulated). The original refund record is never edited or deleted." label="Reason for reversal" confirmLabel="Reverse refund"
        onConfirm={(r) => run((d) => reverseRefund(d, refund.id, r, actor), 'Refund reversed by a separate reversing entry (simulated).')} />
    </>
  )
}

function RefundRequestDialog({ refund, onClose, onSubmit }: {
  refund: Refund | null
  onClose: () => void
  onSubmit: (i: { bankName: string; accountName: string; accountNumber: string; confirmedAmount: number; policyAcknowledged: boolean }) => string | null
}) {
  const [bankName, setBank] = useState('')
  const [accountName, setName] = useState('')
  const [accountNumber, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [ack, setAck] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setBank(''); setName(''); setNumber(''); setAmount(''); setAck(false); setError(''); onClose() }
  const submit = () => {
    const err = onSubmit({ bankName, accountName, accountNumber, confirmedAmount: Math.round(Number(amount) * 100), policyAcknowledged: ack })
    if (err) return setError(err)
    close()
  }

  return (
    <Dialog open={!!refund} onClose={close} title="Refund request" description="Simulated — use any demo values. Do not enter a real bank account." footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={submit}>Submit request</Button></>}>
      {refund && (
        <div className="space-y-3">
          <Field label="Bank name" required><Input value={bankName} onChange={(e) => { setBank(e.target.value); setError('') }} placeholder="Demo Bank" /></Field>
          <Field label="Account name" required><Input value={accountName} onChange={(e) => { setName(e.target.value); setError('') }} /></Field>
          <Field label="Account number (10 digits, demo only)" required hint="Only the last four digits are kept."><Input inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => { setNumber(e.target.value); setError('') }} placeholder="0123456789" /></Field>
          <Field label={`Confirm refund amount (₦) — ${formatKobo(refund.amount)}`} required><Input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setError('') }} /></Field>
          <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={ack} onChange={(e) => { setAck(e.target.checked); setError('') }} /> I have read and accept the refund policy.</label>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </Dialog>
  )
}
