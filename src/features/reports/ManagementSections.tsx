import { Link } from 'react-router'
import { newestFirst, visibleApplications, visibleBookings } from '@/app/selectors'
import { useStore } from '@/app/store'
import { Badge, buttonClass, Card, CardHeader, Table, Td, Th } from '@/components/ui/primitives'
import { BookingTable } from '@/features/bookings/BookingTable'
import { RegistrationTable } from '@/features/registrations/RegistrationTable'

const viewAll = (to: string) => <Link to={to} className={buttonClass('ghost', 'sm')}>View all</Link>

/** Managing Director only: under the reports, the latest applications (view only) and the customer accounts. */
export function ManagementSections() {
  const { data, persona } = useStore()
  const bookings = visibleBookings(data, persona).slice(0, 5)
  const apps = visibleApplications(data, persona).slice(0, 5)
  const customers = newestFirst(data.customers, (c) => c.activatedAt).slice(0, 6)
  return (
    <>
      <h2 className="mb-3 mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Applications <span className="font-normal normal-case text-slate-400">· view only</span></h2>
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Latest bookings" description="Newest first" action={viewAll('/bookings')} />
          <BookingTable bookings={bookings} showPayment emptyTitle="No bookings yet" />
        </Card>
        <Card>
          <CardHeader title="Latest registrations" description="Newest first" action={viewAll('/registrations')} />
          <RegistrationTable applications={apps} emptyTitle="No registrations yet" />
        </Card>
      </div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Customers</h2>
      <Card className="mb-6">
        <CardHeader title="Customer accounts" description="Open a customer to suspend, blacklist or reactivate" action={viewAll('/customers')} />
        <Table>
          <thead><tr><Th>Company</Th><Th>District</Th><Th>Status</Th><Th>Account</Th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <Td><Link to={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.companyName}</Link></Td>
                <Td>{c.district}</Td>
                <Td><Badge tone={c.eligibility.isPriority ? 'accent' : 'neutral'}>{c.eligibility.isPriority ? 'Priority' : 'Non-Priority'}</Badge></Td>
                <Td><Badge tone={c.accountStatus === 'active' ? 'success' : c.accountStatus === 'suspended' ? 'warning' : 'danger'}>{c.accountStatus}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
