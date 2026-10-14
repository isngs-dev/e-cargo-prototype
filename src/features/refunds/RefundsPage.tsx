import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, Landmark, Search, Send, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName } from '@/app/selectors'
import { EmptyState, Notice, PageHeader } from '@/components/ui/blocks'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/fields'
import { Badge, Button, Card, Input } from '@/components/ui/primitives'
import { ActivityList } from '@/features/audit/ActivityList'
import { StageTracker } from '@/features/audit/Timeline'
import { formatDateTime } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import { advanceRefund, refundSteps, submitRefundRequest, triggerRefund } from '@/lib/workflow/refund'
import type { Actor } from '@/lib/workflow/result'
import type { Refund } from '@/types/domain'

const tone = (s: Refund['status']) => (s === 'processed' ? 'success' : s === 'awaiting_director' ? 'warning' : 'info')

export function RefundsPage() {
  const { data, persona, act } = useStore()
  const [flash, setFlash] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<Refund | null>(null)

  const actor: Actor = { name: persona.name, role: persona.role, customerId: persona.customerId }
  const isDir = persona.role === 'director_operations'
  const isSA = persona.role === 'super_admin'
  const isFac = persona.role === 'cargo_facilitator'
  const refunds = [...data.refunds].filter((r) => (isFac ? r.customerId === persona.customerId : true)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const run = (fn: Parameters<typeof act>[0], msg: string) => {
    const r = act(fn)
    if (!r.ok) { setFlash(`Not done: ${r.error}`); return }
    setFlash(msg)
  }

  return (
    <>
      <PageHeader title="Refunds" description="Refund flow after a physical-verification failure on a paid booking. The Director triggers it; Super Admin processes it. All simulated." />
      <div className="mb-4"><Notice title="Simulated refunds">No bank is contacted and no money moves. Only a masked account reference is kept — never enter a real account number.</Notice></div>
      {flash && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <p>{flash}</p>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="text-emerald-700"><X className="size-4" /></button>
        </div>
      )}
      {refunds.length === 0 ? (
        <Card><EmptyState title="No refunds" description="A refund starts when the Head of Port fails a paid booking at physical verification." icon={Landmark} /></Card>
      ) : (
        <div className="space-y-4">
          {refunds.map((r) => {
            const booking = data.bookings.find((b) => b.id === r.bookingId)
            const at = refundSteps.findIndex((s) => s.status === r.status)
            const history = data.audit.filter((e) => e.entityType === 'refund' && e.entityId === r.id).slice().reverse()
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{customerName(data, r.customerId)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                      <Link to={`/bookings/${r.bookingId}`} className="font-mono text-sm text-brand-700 hover:underline">{booking?.reference ?? r.bookingId}</Link>
                      <span className="tabular-nums">{formatKobo(r.amount)}</span>
                      <Badge tone={tone(r.status)}>{refundSteps[at]?.label}</Badge>
                    </p>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600"><span className="font-medium">Rejection reason:</span> {r.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isDir && r.status === 'awaiting_director' && <Button onClick={() => run((d) => triggerRefund(d, r.id, actor), 'Refund link triggered. The facilitator receives the rejection reason and the request form (email simulated).')}><Send className="size-4" /> Trigger refund link</Button>}
                    {isFac && r.status === 'link_sent' && <Button onClick={() => setRequesting(r)}><Landmark className="size-4" /> Submit refund request</Button>}
                    {isSA && r.status === 'requested' && <Button onClick={() => run((d) => advanceRefund(d, r.id, 'review', actor), 'Verification started — refund is under review.')}><Search className="size-4" /> Start review</Button>}
                    {isSA && r.status === 'under_review' && <Button onClick={() => run((d) => advanceRefund(d, r.id, 'approve', actor), 'Refund verified and approved.')}><CircleCheck className="size-4" /> Approve refund</Button>}
                    {isSA && r.status === 'approved' && <Button onClick={() => run((d) => advanceRefund(d, r.id, 'process', actor), 'Refund processed (simulated Paystack — no money moved). The customer is notified (simulated).')}><Landmark className="size-4" /> Process refund (simulated)</Button>}
                  </div>
                </div>

                <div className="mt-5"><StageTracker steps={refundSteps.map((s) => s.label)} at={r.status === 'processed' ? refundSteps.length : at} label="Refund progress" /></div>

                {r.request && (
                  <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-slate-500">Bank (simulated)</dt><dd className="font-medium">{r.request.bankName}</dd></div>
                    <div><dt className="text-xs text-slate-500">Account</dt><dd className="font-medium">{r.request.accountName} {r.request.accountMask}</dd></div>
                    <div><dt className="text-xs text-slate-500">Requested</dt><dd className="font-medium">{formatDateTime(r.request.requestedAt)}</dd></div>
                  </dl>
                )}
                {r.processedAt && <p className="mt-3 text-sm text-emerald-800">Processed {formatDateTime(r.processedAt)} · reference <span className="font-mono">{r.reference}</span> (simulated)</p>}
                {r.status === 'link_sent' && r.linkSentAt && <p className="mt-3 text-xs text-slate-500">Refund link sent {formatDateTime(r.linkSentAt)}. Request window: {data.config.refundWindowDays} days (proposed — pending NRC confirmation).</p>}

                {history.length > 0 && (
                  <details className="mt-4 rounded-md border border-slate-200">
                    <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700">History ({history.length})</summary>
                    <ActivityList entries={history} />
                  </details>
                )}
              </Card>
            )
          })}
        </div>
      )}
      <RefundRequestDialog refund={requesting} onClose={() => setRequesting(null)} onSubmit={(input) => {
        const r = act((d) => submitRefundRequest(d, requesting!.id, input, actor))
        if (!r.ok) return r.error
        setFlash('Refund request submitted. Super Admin will verify it (simulated).')
        return null
      }} />
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
