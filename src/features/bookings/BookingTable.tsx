import { useStore } from '@/app/store'
import { bookingAmount, containerSummary, customerName, routeLabel } from '@/app/selectors'
import { BookingStatusBadge, EmptyState, PaymentStatusBadge } from '@/components/ui/blocks'
import { Table, Td, Th } from '@/components/ui/primitives'
import { formatDate } from '@/lib/format'
import { formatKobo } from '@/lib/money'
import type { Booking } from '@/types/domain'
import { TriangleAlert } from 'lucide-react'

export function BookingTable({
  bookings,
  showCustomer = true,
  showPayment = false,
  emptyTitle = 'No bookings',
  emptyDescription,
}: {
  bookings: Booking[]
  showCustomer?: boolean
  showPayment?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  const { data } = useStore()
  if (bookings.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return (
    <Table>
      <thead>
        <tr>
          <Th>Booking</Th>
          {showCustomer && <Th>Company</Th>}
          <Th>Route</Th>
          <Th>Cargo</Th>
          <Th className="text-right">Amount</Th>
          <Th>Status</Th>
          {showPayment && <Th>Payment</Th>}
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => {
          const amt = bookingAmount(b)
          return (
            <tr key={b.id} className="hover:bg-slate-50/60">
              <Td>
                <p className="whitespace-nowrap font-mono text-xs font-medium text-slate-900">{b.reference}</p>
                <p className="whitespace-nowrap text-xs text-slate-500">For {formatDate(b.bookingDate)}</p>
              </Td>
              {showCustomer && <Td className="max-w-56 truncate">{customerName(data, b.customerId)}</Td>}
              <Td className="whitespace-nowrap">{routeLabel(data, b.routeId)}</Td>
              <Td>
                <p className="whitespace-nowrap">{containerSummary(b)}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  {b.weightTons} t
                  {b.hazardous && (
                    <span className="inline-flex items-center gap-0.5 text-amber-700">
                      · <TriangleAlert className="size-3" aria-hidden /> Hazardous
                    </span>
                  )}
                </p>
              </Td>
              <Td className="text-right">
                <p className="whitespace-nowrap font-medium tabular-nums text-slate-900">{formatKobo(amt.amount)}</p>
                <p className="text-xs text-slate-500">{amt.frozen ? 'Approved (frozen)' : 'Indicative'}</p>
              </Td>
              <Td><BookingStatusBadge status={b.status} /></Td>
              {showPayment && <Td><PaymentStatusBadge status={b.payment.status} /></Td>}
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
