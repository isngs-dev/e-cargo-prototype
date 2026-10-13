import { useNavigate } from 'react-router'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { bookingBlock, createBooking, emptyBooking } from '@/lib/workflow/booking'
import { BookingForm } from './BookingForm'

export function NewBookingPage() {
  const { data, persona, act } = useStore()
  const navigate = useNavigate()
  const customer = data.customers.find((c) => c.id === persona.customerId)
  if (!customer) return <Notice tone="warning" title="No company is linked to this demo persona.">Bookings can only be created by an activated cargo facilitator.</Notice>

  const blocked = bookingBlock(data, customer)

  const onSubmit = (v: Parameters<typeof createBooking>[1]) => {
    const r = act((d) => createBooking(d, v, { name: persona.name, role: persona.role, customerId: customer.id }))
    if (!r.ok) return r.error
    navigate(`/bookings/${r.bookingId}`, { state: { flash: 'Booking submitted. It is now with the Head of Cargo for review (notification simulated). No payment has been taken.' } })
    return null
  }

  return (
    <>
      <PageHeader title="New booking" description={`${customer.companyName} · ${customer.eligibility.isPriority ? 'Priority' : 'Non-Priority'} customer`} />
      {blocked ? <Notice tone="warning" title="You cannot create a booking right now">{blocked}</Notice> : <BookingForm customer={customer} initial={emptyBooking()} onSubmit={onSubmit} />}
    </>
  )
}
