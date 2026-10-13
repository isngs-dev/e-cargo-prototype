import { useNavigate, useParams } from 'react-router'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { bookingBlock, resubmitBooking, type BookingInput } from '@/lib/workflow/booking'
import { BookingForm } from './BookingForm'

/** Facilitator corrects a booking sent back by the Head of Cargo. */
export function EditBookingPage() {
  const { id } = useParams()
  const { data, persona, act } = useStore()
  const navigate = useNavigate()
  const booking = data.bookings.find((b) => b.id === id)
  const customer = data.customers.find((c) => c.id === persona.customerId)

  if (!booking || !customer || booking.customerId !== customer.id) return <Notice tone="warning" title="You cannot edit this booking." />
  if (booking.status !== 'sent_back_to_facilitator') {
    return <Notice tone="warning" title="This booking is not awaiting correction.">Only bookings sent back by the Head of Cargo can be edited and resubmitted.</Notice>
  }
  const blocked = bookingBlock(data, customer)

  const lastRemark = [...data.audit].reverse().find((e) => e.entityId === booking.id && e.toStatus === 'sent_back_to_facilitator')?.remarks
  const initial: BookingInput = {
    bookingDate: booking.bookingDate, cargoType: booking.cargoType, routeId: booking.routeId, containers: booking.containers,
    weightTons: booking.weightTons, commodity: booking.commodity, hazardous: booking.hazardous, specialHandling: booking.specialHandling ?? '',
    remarks: booking.remarks ?? '', documents: booking.documents, declaration: false,
  }

  const onSubmit = (v: BookingInput) => {
    const r = act((d) => resubmitBooking(d, booking.id, v, { name: persona.name, role: persona.role, customerId: customer.id }))
    if (!r.ok) return r.error
    navigate(`/bookings/${booking.id}`, { state: { flash: 'Booking resubmitted to the Head of Cargo (notification simulated). No payment has been taken.' } })
    return null
  }

  return (
    <>
      <PageHeader title="Correct and resubmit" description={`${booking.reference} · ${customer.companyName}`} />
      {lastRemark && <div className="mb-4"><Notice tone="warning" title="Head of Cargo’s comments">{lastRemark}</Notice></div>}
      {blocked ? <Notice tone="warning" title="You cannot resubmit right now">{blocked}</Notice> : <BookingForm customer={customer} initial={initial} onSubmit={onSubmit} submitLabel="Resubmit booking" />}
    </>
  )
}
