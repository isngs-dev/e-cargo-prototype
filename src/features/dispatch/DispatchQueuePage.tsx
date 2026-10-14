import { useStore } from '@/app/store'
import { PageHeader } from '@/components/ui/blocks'
import { Card, CardHeader } from '@/components/ui/primitives'
import { BookingTable } from '@/features/bookings/BookingTable'
import { AWB_STATUSES, isReadyForDispatch } from '@/lib/status'

export function DispatchQueuePage() {
  const { data } = useStore()
  const sorted = [...data.bookings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const ready = sorted.filter(isReadyForDispatch)
  const held = sorted.filter((b) => b.status === 'awaiting_payment')
  const done = sorted.filter((b) => AWB_STATUSES.includes(b.status)).slice(0, 6)
  return (
    <>
      <PageHeader title="Dispatch queue" description="Only bookings whose payment or approved credit condition is satisfied reach this queue. Open a booking to verify, record dispatch details and generate the AWB." />
      <div className="space-y-6">
        <Card>
          <CardHeader title={`Awaiting dispatch (${ready.length})`} description="Payment cleared or credit approved" />
          <BookingTable bookings={ready} showPayment emptyTitle="Nothing is waiting for dispatch" />
        </Card>
        <Card>
          <CardHeader title={`Held — awaiting payment (${held.length})`} description="Not released to the port until payment clears" />
          <BookingTable bookings={held} showPayment emptyTitle="No bookings are held for payment" />
        </Card>
        <Card>
          <CardHeader title="Recently dispatched" description="AWB generated" />
          <BookingTable bookings={done} showPayment emptyTitle="No AWBs generated yet" />
        </Card>
      </div>
    </>
  )
}
