import { Link, useNavigate } from 'react-router'
import { BadgeCheck, CalendarCheck, FileCheck2, Mail, QrCode, Scale, ShieldCheck, Wallet } from 'lucide-react'
import { useStore } from '@/app/store'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Button, buttonClass, Card } from '@/components/ui/primitives'
import { availability, loadLevel, type LoadLevel } from '@/lib/capacity'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/workflow/booking'

const services = [
  { icon: FileCheck2, title: 'Digital onboarding', text: 'Register your company online. A District Supervisor verifies your documents and the Director of Operations activates your account.' },
  { icon: CalendarCheck, title: 'Capacity-linked booking', text: 'Choose a route and date, see whether slots are available, and get a live price breakdown before you submit.' },
  { icon: Wallet, title: 'Clear payment terms', text: 'Pay only after approval. Eligible customers may be offered credit terms set by NRC.' },
  { icon: QrCode, title: 'AWB with QR verification', text: 'Receive an Air Waybill once the consignment passes physical verification and dispatch is approved.' },
]

const steps = ['Register', 'Verification', 'Approval', 'Book cargo', 'Cargo & Director review', 'Pay or credit', 'Port verification', 'AWB issued']

const faqs: [string, string][] = [
  ['Who can register as a cargo facilitator?', 'Companies that can provide a CAC number, a CAC certificate and a company profile. A tax certificate may be requested depending on NRC configuration. You choose your district (Lagos or Ibadan) when you register.'],
  ['When do I pay for a booking?', 'After the Director of Operations approves it — never when you submit. You then pay by payment link, or, if NRC has approved credit terms for you, after the agreed credit period.'],
  ['What are Priority and Non-Priority customers?', 'It is a status assigned by NRC at registration. Priority customers may be eligible for a discount and credit within limits set for them. Non-Priority customers pay by payment link and receive no booking-level discount.'],
  ['What happens if my cargo fails the physical check?', 'The booking is cancelled and the slot is released. If you had already paid, the Director triggers a refund and you submit a refund request, which Super Admin processes.'],
  ['What is an AWB?', 'The Air Waybill issued for your consignment. It carries a unique number and a QR code so it can be verified at the gate. If details change, a new version is issued and the earlier version is marked superseded.'],
  ['Is this the live system?', 'No. This is a prototype for demonstration. Payments, emails and refunds are simulated, all data is fictional and stored only in your browser.'],
]

const levelStyle: Record<LoadLevel, string> = {
  open: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  limited: 'bg-amber-50 text-amber-800 ring-amber-200',
  full: 'bg-red-50 text-red-700 ring-red-200',
  maintenance: 'bg-slate-200 text-slate-700 ring-slate-300',
}
const levelWord: Record<LoadLevel, string> = { open: 'Open', limited: 'Limited', full: 'Full', maintenance: 'Blocked' }

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function LandingPage() {
  const { data, switchPersona } = useStore()
  const navigate = useNavigate()
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i))

  const register = () => { switchPersona('p-fac-applicant'); navigate('/register') }

  return (
    <PublicLayout>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Nigerian Railway Corporation</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Book rail cargo online — from registration to Air Waybill.</h1>
          <p className="mt-4 max-w-2xl text-brand-100">NRC e-Cargo digitises facilitator onboarding, capacity-linked booking, multi-level approvals, payment governance, operational validation and AWB generation, with a full audit trail.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={register} className="bg-white text-brand-900 hover:bg-brand-50">Register your company</Button>
            <Link to="/dashboard" className={buttonClass('secondary', 'md', 'border-white/30 bg-transparent text-white hover:bg-white/10')}>Open the demo platform</Link>
            <Link to="/verify" className={buttonClass('ghost', 'md', 'text-white hover:bg-white/10')}>Verify an AWB</Link>
          </div>
          <p className="mt-4 text-xs text-brand-200">No login in this prototype — a role switcher lets you view the platform as each NRC role or as a customer.</p>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-xl font-semibold text-slate-900">NRC Cargo Services</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-5">
              <span className="flex size-10 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Card>
          ))}
        </div>
        <ol className="mt-8 flex flex-wrap gap-2 text-sm" aria-label="How it works">
          {steps.map((s, i) => <li key={s} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"><span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{i + 1}</span>{s}</li>)}
        </ol>
      </section>

      <section id="availability" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold text-slate-900">Train availability — next 7 days</h2>
          <p className="mt-1 text-sm text-slate-500">Simulated from the demo capacity settings; the capacity rule is pending NRC confirmation.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-xs">
              <thead><tr><th className="w-44 text-left font-semibold uppercase tracking-wide text-slate-500">Route</th>{days.map((d) => <th key={d} className="font-medium text-slate-500">{new Date(`${d}T12:00:00`).toLocaleDateString('en-NG', { weekday: 'short', day: '2-digit', month: 'short' })}</th>)}</tr></thead>
              <tbody>
                {data.routes.filter((r) => r.active).map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="text-left font-medium text-slate-900">{r.origin} → {r.destination}</th>
                    {days.map((d) => { const lvl = loadLevel(availability(data, r.id, d)); return <td key={d} className={cn('rounded px-1 py-2 font-medium ring-1 ring-inset', levelStyle[lvl])}>{levelWord[lvl]}</td> })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-dashed p-6">
            <div className="flex items-center gap-2"><Scale className="size-5 text-brand-700" aria-hidden /><h2 className="text-lg font-semibold text-slate-900">NRC Fair Cargo Policy</h2></div>
            <p className="mt-3 text-sm text-slate-600">The policy highlights will be supplied by NRC. During booking, every customer must confirm: <em>“I confirm compliance with NRC Fair Cargo Policy.”</em></p>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Placeholder — no policy wording has been provided for this prototype, so none is shown here.</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-700" aria-hidden /><h2 className="text-lg font-semibold text-slate-900">Built for governance</h2></div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {['Separate business authority (NRC) and platform authority (service provider)', 'Every approval, rejection and change is recorded with who, when and why', 'Prices are frozen at Director approval and never silently changed', 'Refunds need two parties: the Director triggers, Super Admin executes'].map((t) => <li key={t} className="flex gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />{t}</li>)}
            </ul>
          </Card>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
        <h2 className="text-xl font-semibold text-slate-900">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {faqs.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-900 marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <div><h2 className="text-lg font-semibold text-slate-900">Contact Cargo Operations</h2><p className="mt-1 text-sm text-slate-600">Demonstration contact — not a monitored address.</p></div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800"><Mail className="size-4 text-brand-700" aria-hidden /> cargo.operations@nrc.demo</p>
        </div>
      </section>
    </PublicLayout>
  )
}
