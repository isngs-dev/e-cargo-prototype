import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName, routeLabel } from '@/app/selectors'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Notice } from '@/components/ui/blocks'
import { Badge, Button, Card, Input } from '@/components/ui/primitives'
import { formatDate, formatDateTime } from '@/lib/format'
import { verifyAwb } from '@/lib/awb'

/** Demo gate check: what the QR on an AWB points at. Looks the AWB up in THIS browser's demo data only. */
export function VerifyAwbPage() {
  const { data } = useStore()
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('awb') ?? '')
  const awb = params.get('awb')
  const version = params.get('v') ? Number(params.get('v')) : undefined
  const result = awb ? verifyAwb(data.bookings, awb, version && Number.isInteger(version) ? version : undefined) : null

  return (
    <PublicLayout>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verify an AWB</h1>
        <p className="mt-1 text-sm text-slate-500">Enter an AWB number, or scan its QR code. A forged number fails the check digit; an older version is reported as superseded.</p>
        <div className="mt-4"><Notice tone="warning" title="Demonstration only">This checks AWBs in this browser’s demo data. It is not a signed production verification and cannot confirm a real consignment.</Notice></div>

        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { awb: input.trim() } : {}) }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="NRC-AWB-26-000101-8" aria-label="AWB number" className="font-mono" />
          <Button type="submit">Verify</Button>
        </form>

        {result && (
          <Card className="mt-6 p-5" aria-live="polite">
            {result.status === 'valid' && (
              <div className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
                <div className="text-sm">
                  <p className="text-base font-semibold text-emerald-800">Valid — current version {result.version}</p>
                  <p className="mt-1 text-slate-700"><span className="font-mono">{awb}</span> · {result.booking.reference}</p>
                  <p className="text-slate-600">{customerName(data, result.booking.customerId)} · {routeLabel(data, result.booking.routeId)}</p>
                  {result.booking.dispatch && <p className="text-slate-600">Train {result.booking.dispatch.trainNumber}, wagon {result.booking.dispatch.wagonNumber} · departs {formatDate(result.booking.dispatch.departureDate)} {result.booking.dispatch.departureTime}</p>}
                  <p className="mt-1 text-xs text-slate-500">Issued {formatDateTime(result.booking.awb!.generatedAt)}</p>
                </div>
              </div>
            )}
            {result.status === 'superseded' && (
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-600" aria-hidden />
                <div className="text-sm">
                  <p className="text-base font-semibold text-amber-800">Superseded — version {result.version} is no longer valid</p>
                  <p className="mt-1 text-slate-700">The current version of <span className="font-mono">{awb}</span> is <Badge tone="success">version {result.currentVersion}</Badge>. Do not release cargo against the older version.</p>
                </div>
              </div>
            )}
            {result.status === 'not_found' && (
              <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-6 shrink-0 text-red-600" aria-hidden /><div className="text-sm"><p className="text-base font-semibold text-red-800">Not found</p><p className="mt-1 text-slate-600">No AWB with this number (and version) exists in this browser’s demo data.</p></div></div>
            )}
            {result.status === 'invalid_number' && (
              <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-6 shrink-0 text-red-600" aria-hidden /><div className="text-sm"><p className="text-base font-semibold text-red-800">Invalid AWB number — possible forgery</p><p className="mt-1 text-slate-600">The number is malformed or fails its check digit. Format: NRC-AWB-YY-NNNNNN-C.</p></div></div>
            )}
          </Card>
        )}
      </section>
    </PublicLayout>
  )
}
