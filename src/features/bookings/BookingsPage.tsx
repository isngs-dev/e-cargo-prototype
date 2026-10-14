import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useLocation } from 'react-router'
import { useStore } from '@/app/store'
import { customerName, routeLabel, visibleBookings } from '@/app/selectors'
import { Flash, PageHeader } from '@/components/ui/blocks'
import { Badge, Button, buttonClass, Card, CardHeader, Input, Select } from '@/components/ui/primitives'
import { formatDate } from '@/lib/format'
import { leaveWaitlist } from '@/lib/workflow/booking'
import { Link } from 'react-router'
import { bookingStatusMeta } from '@/lib/status'
import type { BookingStatus } from '@/types/domain'
import { BookingTable } from './BookingTable'

export function BookingsPage() {
  const { data, persona, act } = useStore()
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)
  const waiting = data.waitlist.filter((w) => w.customerId === persona.customerId && w.status === 'waiting')
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
        description={isFacilitator ? 'Bookings submitted by your company.' : 'Bookings visible to your role. Open one to review, approve or dispatch it.'}
        actions={isFacilitator && persona.customerId ? <Link to="/bookings/new" className={buttonClass('primary')}>New booking</Link> : undefined}
      />
      <Flash message={flash} onDismiss={() => setFlash(null)} />
      {isFacilitator && waiting.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={`Waitlist (${waiting.length})`} description="Dates you are waiting for. A waitlist entry is not a booking." />
          <ul className="divide-y divide-slate-100">
            {waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><span className="font-medium text-slate-900">{routeLabel(data, w.routeId)}</span> · {formatDate(w.date)} <Badge tone="info" className="ml-1">Waiting</Badge><span className="block text-xs text-slate-500">{w.summary} · {w.units} capacity unit{w.units === 1 ? '' : 's'}</span></span>
                <Button size="sm" variant="secondary" onClick={() => { const r = act((d) => leaveWaitlist(d, w.id, { name: persona.name, role: persona.role, customerId: persona.customerId })); setFlash(r.ok ? 'Removed from the waitlist.' : `Not done: ${r.error}`) }}>Leave waitlist</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
