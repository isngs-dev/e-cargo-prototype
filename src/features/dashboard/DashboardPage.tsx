import { Link } from 'react-router'
import {
  Banknote,
  BadgeCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  FileText,
  Hourglass,
  Package,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
  Truck,
  Undo2,
  UserCog,
  Wallet,
} from 'lucide-react'
import { useStore } from '@/app/store'
import { customerName, visibleBookings } from '@/app/selectors'
import { DemoTag, KpiCard, Notice, PageHeader } from '@/components/ui/blocks'
import { buttonClass, Card, CardHeader } from '@/components/ui/primitives'
import { BookingTable } from '@/features/bookings/BookingTable'
import { RegistrationTable } from '@/features/registrations/RegistrationTable'
import { ActivityList } from '@/features/audit/ActivityList'
import { EligibilityCard } from '@/features/customers/EligibilityCard'
import { outstandingCredit } from '@/lib/eligibility'
import { formatKobo } from '@/lib/money'
import { roleLabels } from '@/lib/permissions'
import { AWB_STATUSES, isReadyForDispatch, PENDING_APPROVAL, REJECTED_STATUSES } from '@/lib/status'

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

const viewAll = (to: string) => (
  <Link to={to} className={buttonClass('ghost', 'sm')}>View all</Link>
)

function FacilitatorDashboard() {
  const { data, persona } = useStore()
  const customer = data.customers.find((c) => c.id === persona.customerId)
  const mine = visibleBookings(data, persona)
  if (!customer) return <Notice tone="warning" title="No company linked to this demo persona." />
  return (
    <>
      <Grid>
        <KpiCard label="Total bookings" value={mine.length} icon={Package} />
        <KpiCard label="Pending approval" value={mine.filter((b) => PENDING_APPROVAL.includes(b.status)).length} icon={Hourglass} tone="info" />
        <KpiCard label="Awaiting payment" value={mine.filter((b) => b.status === 'awaiting_payment').length} icon={Wallet} tone="warning" hint="Pay-now bookings after Director approval" />
        <KpiCard label="AWB generated" value={mine.filter((b) => AWB_STATUSES.includes(b.status)).length} icon={QrCode} tone="success" />
      </Grid>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="My bookings" description="Live status of every booking for your company" action={viewAll('/bookings')} />
          <BookingTable bookings={mine.slice(0, 6)} showCustomer={false} showPayment emptyTitle="No bookings yet" />
        </Card>
        <EligibilityCard customer={customer} outstanding={outstandingCredit(data.bookings, customer.id)} />
      </div>
    </>
  )
}

function DistrictSupervisorDashboard() {
  const { data } = useStore()
  const apps = data.applications
  const queue = apps.filter((a) => a.status === 'pending_district_verification' || a.status === 'sent_back_to_district')
  return (
    <>
      <Grid>
        <KpiCard label="Pending verification" value={queue.length} icon={ClipboardCheck} tone="info" hint="Includes Director send-backs" />
        <KpiCard label="Forwarded / approved" value={apps.filter((a) => a.status === 'pending_director_approval' || a.status === 'activated').length} icon={BadgeCheck} tone="success" />
        <KpiCard label="Sent back to facilitator" value={apps.filter((a) => a.status === 'sent_back_to_facilitator').length} icon={Undo2} tone="warning" />
        <KpiCard label="Rejected" value={apps.filter((a) => a.status === 'rejected').length} icon={CircleX} tone="danger" />
      </Grid>
      <Card className="mt-6">
        <CardHeader title="Verification queue" description="Verify documents against submitted details. Eligibility is decided by the Director, not here." action={viewAll('/registrations')} />
        <RegistrationTable applications={queue} emptyTitle="No applications awaiting verification" />
      </Card>
    </>
  )
}

function HeadOfCargoDashboard() {
  const { data } = useStore()
  const queue = data.bookings.filter((b) => b.status === 'pending_hoc_review' || b.status === 'sent_back_to_hoc')
  return (
    <>
      <Grid>
        <KpiCard label="Pending booking approvals" value={queue.length} icon={ClipboardCheck} tone="info" />
        <KpiCard label="Hazardous in queue" value={queue.filter((b) => b.hazardous).length} icon={ShieldCheck} tone="warning" hint="Compliance document required" />
        <KpiCard label="Forwarded to Director" value={data.bookings.filter((b) => b.status === 'pending_director_review').length} icon={Clock} />
        <KpiCard label="Sent back to facilitator" value={data.bookings.filter((b) => b.status === 'sent_back_to_facilitator').length} icon={Undo2} tone="warning" />
      </Grid>
      <Card className="mt-6">
        <CardHeader title="Pending booking approvals" description="Verify documents, containers/wagons, weight and hazardous compliance. Discount and payment terms are set by the Director." action={viewAll('/bookings')} />
        <BookingTable bookings={queue} emptyTitle="No bookings awaiting review" />
      </Card>
    </>
  )
}

function DirectorDashboard() {
  const { data } = useStore()
  const regs = data.applications.filter((a) => a.status === 'pending_director_approval')
  const bks = data.bookings.filter((b) => b.status === 'pending_director_review')
  const frozenRevenue = data.bookings.filter((b) => b.approved && !REJECTED_STATUSES.includes(b.status)).reduce((s, b) => s + b.approved!.price.totalPayable, 0)
  return (
    <>
      <Grid>
        <KpiCard label="Registrations pending final approval" value={regs.length} icon={FileText} tone="info" />
        <KpiCard label="Bookings awaiting final approval" value={bks.length} icon={ClipboardCheck} tone="info" />
        <KpiCard label="Refunds awaiting your trigger" value={data.refunds.filter((r) => r.status === 'awaiting_director').length} icon={Undo2} tone="warning" />
        <KpiCard label="Approved booking value" value={formatKobo(frozenRevenue)} icon={Banknote} tone="success" hint="Frozen prices, excl. rejected/cancelled · demo data" />
      </Grid>
      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader title="Bookings awaiting final approval" description="You set the final discount (within eligibility) and payment terms." action={viewAll('/bookings')} />
          <BookingTable bookings={bks} emptyTitle="No bookings awaiting final approval" />
        </Card>
        <Card>
          <CardHeader title="Registrations pending final approval" description="You assign priority status, eligible discount, credit period, threshold and category." action={viewAll('/registrations')} />
          <RegistrationTable applications={regs} emptyTitle="No registrations awaiting approval" />
        </Card>
      </div>
    </>
  )
}

function PortOperationsDashboard() {
  const { data } = useStore()
  const ready = data.bookings.filter(isReadyForDispatch)
  const blocked = data.bookings.filter((b) => b.status === 'awaiting_payment')
  return (
    <>
      <Grid>
        <KpiCard label="Awaiting dispatch" value={ready.length} icon={Truck} tone="accent" hint="Payment or credit condition satisfied" />
        <KpiCard label="AWB generated" value={data.bookings.filter((b) => AWB_STATUSES.includes(b.status)).length} icon={QrCode} tone="success" />
        <KpiCard label="Held — awaiting payment" value={blocked.length} icon={Wallet} tone="warning" hint="Not released to port until payment clears" />
        <KpiCard label="Physical check failures" value={data.bookings.filter((b) => b.status === 'rejected_physical').length} icon={CircleX} tone="danger" />
      </Grid>
      <Card className="mt-6">
        <CardHeader title="Bookings awaiting dispatch" description="Physical verification, wagon/train assignment and AWB generation arrive in Phase 6." />
        <BookingTable bookings={ready} showPayment emptyTitle="Nothing ready for dispatch" />
      </Card>
    </>
  )
}

function SuperAdminDashboard() {
  const { data } = useStore()
  return (
    <>
      <Notice title="Platform authority only">
        Super Admin manages credentials, master data, configuration, reconciliation and refund execution. It cannot approve registrations or bookings, set discounts or credit, or trigger refunds.
      </Notice>
      <div className="mt-4">
        <Grid>
          <KpiCard label="Active staff accounts" value={data.staff.filter((s) => s.status === 'active').length} icon={UserCog} hint={`${data.staff.length} total · ${data.staff.filter((s) => s.status === 'pending_first_login').length} pending first login`} />
          <KpiCard label="Payment exceptions" value={data.paymentExceptions.filter((p) => !p.resolved).length} icon={Receipt} tone="warning" />
          <KpiCard label="Refunds to process" value={data.refunds.filter((r) => r.status === 'requested' || r.status === 'under_review' || r.status === 'approved').length} icon={Undo2} hint="After Director trigger + customer request" />
          <KpiCard label="Audit events" value={data.audit.length} icon={ScrollText} hint="Demo log — not tamper-proof" />
        </Grid>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent activity" description="Across all roles" action={viewAll('/audit')} />
          <ActivityList entries={[...data.audit].reverse().slice(0, 8)} />
        </Card>
        <Card>
          <CardHeader title="Unresolved payment exceptions" description="Simulated reconciliation queue" />
          <ul className="divide-y divide-slate-100">
            {data.paymentExceptions.filter((p) => !p.resolved).map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-slate-700">{p.reference}</span>
                  <span className="text-sm font-medium tabular-nums">{formatKobo(p.amount)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{p.issue}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

const greeting: Record<string, string> = {
  cargo_facilitator: 'Track your bookings, pricing and AWBs.',
  district_supervisor: 'Verify new facilitator registrations.',
  head_of_cargo: 'Review cargo bookings before final approval.',
  director_operations: 'Final business approvals, eligibility and payment terms.',
  head_port_operations: 'Physical verification, dispatch and AWB generation.',
  super_admin: 'Platform administration and oversight.',
}

export function DashboardPage() {
  const { persona, data } = useStore()
  const subtitle = persona.customerId ? `${customerName(data, persona.customerId)} · ${greeting[persona.role]}` : greeting[persona.role]
  return (
    <>
      <PageHeader title={`${roleLabels[persona.role]} dashboard`} description={<span className="inline-flex flex-wrap items-center gap-2">{subtitle} <DemoTag /></span>} />
      {persona.role === 'cargo_facilitator' && <FacilitatorDashboard />}
      {persona.role === 'district_supervisor' && <DistrictSupervisorDashboard />}
      {persona.role === 'head_of_cargo' && <HeadOfCargoDashboard />}
      {persona.role === 'director_operations' && <DirectorDashboard />}
      {persona.role === 'head_port_operations' && <PortOperationsDashboard />}
      {persona.role === 'super_admin' && <SuperAdminDashboard />}
    </>
  )
}
