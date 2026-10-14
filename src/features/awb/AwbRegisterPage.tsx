import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { BookingStatusBadge, EmptyState, PageHeader } from '@/components/ui/blocks'
import { Card, Input, Table, Td, Th } from '@/components/ui/primitives'
import { formatDate, formatDateTime } from '@/lib/format'

export function AwbRegisterPage() {
  const { data, persona } = useStore()
  const [query, setQuery] = useState('')
  const isFacilitator = persona.role === 'cargo_facilitator'
  const all = visibleBookings(data, persona).filter((b) => b.awb).sort((a, b) => b.awb!.generatedAt.localeCompare(a.awb!.generatedAt))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((b) => !q || [b.awb!.number, b.reference, customerName(data, b.customerId), b.dispatch?.trainNumber ?? ''].some((s) => s.toLowerCase().includes(q)))
  }, [all, data, query])

  return (
    <>
      <PageHeader title="Air Waybills" description={isFacilitator ? 'AWBs for your company’s bookings.' : 'Generated AWBs visible to your role. Numbers are unique and never reused.'} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search AWB number, booking, company, train" className="pl-9" aria-label="Search AWBs" />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={all.length ? 'No AWBs match your search' : 'No AWBs yet'} description={all.length ? undefined : 'An AWB is generated when the Head of Port approves dispatch.'} />
        ) : (
          <Table>
            <thead>
              <tr><Th>AWB number</Th><Th>Booking</Th>{!isFacilitator && <Th>Company</Th>}<Th>Route</Th><Th>Train / wagon</Th><Th>Departure</Th><Th>Generated</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <Td><Link to={`/bookings/${b.id}/awb`} className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline">{b.awb!.number}</Link></Td>
                  <Td><Link to={`/bookings/${b.id}`} className="whitespace-nowrap font-mono text-xs hover:underline">{b.reference}</Link></Td>
                  {!isFacilitator && <Td className="max-w-48 truncate">{customerName(data, b.customerId)}</Td>}
                  <Td className="whitespace-nowrap">{routeLabel(data, b.routeId)}</Td>
                  <Td className="whitespace-nowrap">{b.dispatch?.trainNumber} · {b.dispatch?.wagonNumber}</Td>
                  <Td className="whitespace-nowrap">{b.dispatch ? `${formatDate(b.dispatch.departureDate)} ${b.dispatch.departureTime}` : '—'}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(b.awb!.generatedAt)}</Td>
                  <Td><BookingStatusBadge status={b.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="px-4 py-3 text-xs text-slate-500">{rows.length} of {all.length} · demonstration data</p>
      </Card>
    </>
  )
}
