import { newestFirst } from '@/app/selectors'
import { Link } from 'react-router'
import { useStore } from '@/app/store'
import { Badge, Card, Table, Td, Th } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/blocks'
import { outstandingCredit } from '@/lib/eligibility'
import { formatDate } from '@/lib/format'
import { formatBp, formatKobo } from '@/lib/money'
import type { CustomerAccountStatus } from '@/types/domain'

const accountTone: Record<CustomerAccountStatus, 'success' | 'warning' | 'danger'> = { active: 'success', suspended: 'warning', blacklisted: 'danger' }

export function CustomersPage() {
  const { data } = useStore()
  return (
    <>
      <PageHeader title="Customers" description="Activated cargo facilitators. Open a customer to manage account status; the Director also changes eligibility, Super Admin corrects records." />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Status</Th>
              <Th>District</Th>
              <Th>Category</Th>
              <Th>Discount</Th>
              <Th>Credit</Th>
              <Th className="text-right">Outstanding / threshold</Th>
              <Th>Account</Th>
            </tr>
          </thead>
          <tbody>
            {newestFirst(data.customers, (c) => c.activatedAt).map((c) => {
              const e = c.eligibility
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link to={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.companyName}</Link>
                    <p className="text-xs text-slate-500">{c.cacNumber} · since {formatDate(c.activatedAt)}</p>
                  </Td>
                  <Td><Badge tone={e.isPriority ? 'success' : 'neutral'}>{e.isPriority ? 'Priority' : 'Non-Priority'}</Badge></Td>
                  <Td>{c.district}</Td>
                  <Td>{e.category}</Td>
                  <Td>{e.isPriority ? `≤ ${formatBp(e.eligibleDiscountBp)}` : '—'}</Td>
                  <Td>{e.isPriority && e.eligibleCreditMonths ? `≤ ${e.eligibleCreditMonths} mo` : '—'}</Td>
                  <Td className="text-right tabular-nums">{e.isPriority ? `${formatKobo(outstandingCredit(data.bookings, c.id))} / ${formatKobo(e.creditThreshold)}` : '—'}</Td>
                  <Td><Badge tone={accountTone[c.accountStatus]}>{c.accountStatus}</Badge></Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
