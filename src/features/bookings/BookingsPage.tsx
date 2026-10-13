import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { PageHeader } from '@/components/ui/blocks'
import { buttonClass, Card, Input, Select } from '@/components/ui/primitives'
import { Link } from 'react-router'
import { bookingStatusMeta } from '@/lib/status'
import type { BookingStatus } from '@/types/domain'
import { BookingTable } from './BookingTable'

export function BookingsPage() {
  const { data, persona } = useStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<BookingStatus | 'all'>('all')
  const isFacilitator = persona.role === 'cargo_facilitator'
  const all = visibleBookings(data, persona)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (b) =>
        (status === 'all' || b.status === status) &&
        (!q || [b.reference, b.commodity, customerName(data, b.customerId), routeLabel(data, b.routeId)].some((s) => s.toLowerCase().includes(q))),
    )
  }, [all, data, query, status])

  const statusesPresent = Array.from(new Set(all.map((b) => b.status)))

  return (
    <>
      <PageHeader
        title={isFacilitator ? 'My bookings' : 'Bookings'}
        description={isFacilitator ? 'Bookings submitted by your company.' : 'Bookings visible to your role. Approval and dispatch actions arrive in Phases 5 and 6.'}
        actions={isFacilitator && persona.customerId ? <Link to="/bookings/new" className={buttonClass('primary')}>New booking</Link> : undefined}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, company, route, commodity" className="pl-9" aria-label="Search bookings" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | 'all')} className="sm:w-72" aria-label="Filter by status">
            <option value="all">All statuses ({all.length})</option>
            {statusesPresent.map((s) => (
              <option key={s} value={s}>{bookingStatusMeta[s].label} ({all.filter((b) => b.status === s).length})</option>
            ))}
          </Select>
        </div>
        <BookingTable
          bookings={filtered}
          showCustomer={!isFacilitator}
          showPayment
          emptyTitle={all.length ? 'No bookings match your filters' : 'No bookings yet'}
          emptyDescription={all.length ? 'Try clearing the search or status filter.' : undefined}
        />
        <p className="px-4 py-3 text-xs text-slate-500">Showing {filtered.length} of {all.length} · demonstration data</p>
      </Card>
    </>
  )
}
