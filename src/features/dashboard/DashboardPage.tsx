import { Link, Navigate } from 'react-router'
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
import { customerName, visibleApplications, visibleBookings, newestFirst } from '@/app/selectors'
import { DemoTag, EmptyState, KpiCard, Notice, PageHeader, RegistrationStatusBadge } from '@/components/ui/blocks'
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

function ApplicantDashboard() {
  const { data, applicantAppId } = useStore()
  const app = data.applications.find((a) => a.id === applicantAppId)
  return (
    <>
      <Notice title="Registration required">You are not yet an active customer. Bookings, pricing and AWBs unlock once the Director approves your registration.</Notice>
      <Card className="mt-6">
        <CardHeader title="My registration" description="Track your application through verification and approval" action={<Link to="/register" className={buttonClass('secondary', 'sm')}>Start a new application</Link>} />
        {app ? (
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{app.companyName}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500">{app.reference}</p>
              {app.latestRemark && app.status === 'sent_back_to_facilitator' && <p className="mt-2 max-w-xl text-sm text-amber-800">“{app.latestRemark}”</p>}
            </div>
            <div className="flex items-center gap-3"><RegistrationStatusBadge status={app.status} /><Link to={`/registrations/${app.id}`} className={buttonClass('primary', 'sm')}>{app.status === 'sent_back_to_facilitator' ? 'Review comments' : 'View application'}</Link></div>
          </div>
        ) : <EmptyState title="No application yet" description="Submit your company details and documents to begin." action={<Link to="/register" className={buttonClass('primary', 'sm')}>Register your company</Link>} />}
      </Card>
    </>
  )
}

function FacilitatorDashboard() {
  const { data, persona } = useStore()
  const customer = data.customers.find((c) => c.id === persona.customerId)
  const mine = visibleBookings(data, persona)
  if (!customer) return <Notice tone="warning" title="No company linked to this demo persona." />
  return (
    <>
      <Grid>
        <KpiCard to="/bookings" label="Total bookings" value={mine.length} icon={Package} />
        <KpiCard to="/bookings" label="Pending approval" value={mine.filter((b) => PENDING_APPROVAL.includes(b.status)).length} icon={Hourglass} tone="info" />
        <KpiCard to="/bookings" label="Awaiting payment" value={mine.filter((b) => b.status === 'awaiting_payment').length} icon={Wallet} tone="warning" hint="Pay-now bookings after Director approval" />
        <KpiCard to="/awbs" label="AWB generated" value={mine.filter((b) => AWB_STATUSES.includes(b.status)).length} icon={QrCode} tone="success" />
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
  const { data, persona } = useStore()
  const apps = visibleApplications(data, persona)
  const queue = apps.filter((a) => a.status === 'pending_district_verification' || a.status === 'sent_back_to_district')
  return (
    <>
      <Grid>
        <KpiCard to="/registrations" label="Pending verification" value={queue.length} icon={ClipboardCheck} tone="info" hint="Includes Director send-backs" />
        <KpiCard to="/registrations" label="Forwarded / approved" value={apps.filter((a) => a.status === 'pending_director_approval' || a.status === 'activated').length} icon={BadgeCheck} tone="success" />
        <KpiCard to="/registrations" label="Sent back to facilitator" value={apps.filter((a) => a.status === 'sent_back_to_facilitator').length} icon={Undo2} tone="warning" />
        <KpiCard to="/registrations" label="Rejected" value={apps.filter((a) => a.status === 'rejected').length} icon={CircleX} tone="danger" />
      </Grid>
      <Card className="mt-6">
         <CardHeader title={`Verification queue — ${persona.district} district`} description="Verify documents against submitted details. Eligibility is decided by the Director, not here." action={viewAll('/registrations')} />
        <RegistrationTable applications={queue} emptyTitle="No applications awaiting verification" />
      </Card>
    </>
  )
}

function HeadOfCargoDashboard() {
  const { data } = useStore()
  const queue = newestFirst(data.bookings.filter((b) => b.status === 'pending_hoc_review' || b.status === 'sent_back_to_hoc'), (b) => b.updatedAt)
  return (
    <>
      <Grid>
        <KpiCard to="/bookings" label="Pending booking approvals" value={queue.length} icon={ClipboardCheck} tone="info" />
        <KpiCard to="/bookings" label="Hazardous in queue" value={queue.filter((b) => b.hazardous).length} icon={ShieldCheck} tone="warning" hint="Compliance document required" />
        <KpiCard to="/bookings" label="Forwarded to Director" value={data.bookings.filter((b) => b.status === 'pending_director_review').length} icon={Clock} />
        <KpiCard to="/bookings" label="Sent back to facilitator" value={data.bookings.filter((b) => b.status === 'sent_back_to_facilitator').length} icon={Undo2} tone="warning" />
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
  const regs = newestFirst(data.applications.filter((a) => a.status === 'pending_director_approval'), (a) => a.updatedAt)
  const bks = newestFirst(data.bookings.filter((b) => b.status === 'pending_director_review'), (b) => b.updatedAt)
  const frozenRevenue = data.bookings.filter((b) => b.approved && !REJECTED_STATUSES.includes(b.status)).reduce((s, b) => s + b.approved!.price.totalPayable, 0)
  return (
    <>
      <Grid>
        <KpiCard to="/registrations" label="Registrations pending final approval" value={regs.length} icon={FileText} tone="info" />
        <KpiCard to="/bookings" label="Bookings awaiting final approval" value={bks.length} icon={ClipboardCheck} tone="info" />
        <KpiCard to="/refunds" label="Refunds awaiting your trigger" value={data.refunds.filter((r) => r.status === 'awaiting_director').length} icon={Undo2} tone="warning" />
        <KpiCard to="/bookings" label="Approved booking value" value={formatKobo(frozenRevenue)} icon={Banknote} tone="success" hint="Frozen prices, excl. rejected/cancelled · demo data" />
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
  const ready = newestFirst(data.bookings.filter(isReadyForDispatch), (b) => b.updatedAt)
  const blocked = newestFirst(data.bookings.filter((b) => b.status === 'awaiting_payment'), (b) => b.updatedAt)
  return (
    <>
      <Grid>
        <KpiCard to="/dispatch" label="Awaiting dispatch" value={ready.length} icon={Truck} tone="accent" hint="Payment or credit condition satisfied" />
        <KpiCard to="/awbs" label="AWB generated" value={data.bookings.filter((b) => AWB_STATUSES.includes(b.status)).length} icon={QrCode} tone="success" />
        <KpiCard to="/dispatch" label="Held — awaiting payment" value={blocked.length} icon={Wallet} tone="warning" hint="Not released to port until payment clears" />
        <KpiCard to="/bookings" label="Physical check failures" value={data.bookings.filter((b) => b.status === 'rejected_physical').length} icon={CircleX} tone="danger" />
      </Grid>
      <Card className="mt-6">
        <CardHeader title="Bookings awaiting dispatch" description="Open a booking to verify it physically, record wagon, train and departure details, and generate the AWB." action={viewAll('/dispatch')} />
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
          <KpiCard to="/staff" label="Active staff accounts" value={data.staff.filter((s) => s.status === 'active').length} icon={UserCog} hint={`${data.staff.length} total · ${data.staff.filter((s) => s.status === 'pending_first_login').length} pending first login`} />
          <KpiCard to="/payments" label="Payment exceptions" value={data.paymentExceptions.filter((p) => !p.resolved).length} icon={Receipt} tone="warning" />
          <KpiCard to="/refunds" label="Refunds to process" value={data.refunds.filter((r) => r.status === 'requested' || r.status === 'under_review' || r.status === 'approved').length} icon={Undo2} hint="After Director trigger + customer request" />
          <KpiCard to="/audit" label="Audit events" value={data.audit.length} icon={ScrollText} hint="Demo log — not tamper-proof" />
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
            {newestFirst(data.paymentExceptions.filter((p) => !p.resolved), (p) => p.receivedAt).map((p) => (
              <li key={p.id}>
                <Link to={`/payments/${p.id}`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs text-slate-700">{p.reference}</span>
                    <span className="text-sm font-medium tabular-nums">{formatKobo(p.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{p.issue}</p>
                </Link>
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
  district_supervisor: 'Verify new facilitator registrations for your district.',
  head_of_cargo: 'Review cargo bookings before final approval.',
  director_operations: 'Final business approvals, eligibility and payment terms.',
  head_port_operations: 'Physical verification, dispatch and AWB generation.',
  super_admin: 'Platform administration and oversight.',
  managing_director: 'Management view: performance, applications and customers.',
}

export function DashboardPage() {
  const { persona, data } = useStore()
  // The Managing Director's home is Reports & Analytics (with applications and customers below it).
  if (persona.role === 'managing_director') return <Navigate to="/reports" replace />
  const subtitle = persona.customerId ? `${customerName(data, persona.customerId)} · ${greeting[persona.role]}` : greeting[persona.role]
  return (
    <>
      <PageHeader actions={persona.customerId ? <Link to="/bookings/new" className={buttonClass('primary')}>New booking</Link> : undefined} title={`${roleLabels[persona.role]} dashboard`} description={<span className="inline-flex flex-wrap items-center gap-2">{subtitle} <DemoTag /></span>} />
      {persona.role === 'cargo_facilitator' && (persona.isApplicant ? <ApplicantDashboard /> : <FacilitatorDashboard />)}
      {persona.role === 'district_supervisor' && <DistrictSupervisorDashboard />}
      {persona.role === 'head_of_cargo' && <HeadOfCargoDashboard />}
      {persona.role === 'director_operations' && <DirectorDashboard />}
      {persona.role === 'head_port_operations' && <PortOperationsDashboard />}
      {persona.role === 'super_admin' && <SuperAdminDashboard />}
    </>
  )
}
