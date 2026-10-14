import { useNavigate } from 'react-router'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Button, Card, CardHeader } from '@/components/ui/primitives'
import { personas } from '@/data/personas'
import { roleLabels } from '@/lib/permissions'

interface Step { persona: string; to: string; title: string; text: string; expect: string }
interface Scene { id: string; title: string; summary: string; steps: Step[] }

/** A walk-through for stakeholders. Every step switches to the right role and opens the right page. Uses the seeded demo data. */
const scenes: Scene[] = [
  {
    id: 'onboarding', title: '1 · Onboard a new customer', summary: 'Registration, district verification and the Director’s eligibility decision.',
    steps: [
      { persona: 'p-fac-applicant', to: '/register', title: 'Apply to register', text: 'Click “Fill demo data”, Next, add the two required documents with “Use sample file”, Next, then Submit. (Choose the Lagos district.)', expect: 'The application is Pending District Verification.' },
      { persona: 'p-ds', to: '/registrations', title: 'District Supervisor verifies', text: 'Open the new application (Lagos district only). Check the automated checks, then “Verified — forward to Director”.', expect: 'Status: Pending Director Approval. An Ibadan supervisor cannot see this application.' },
      { persona: 'p-dir', to: '/registrations', title: 'Director approves', text: 'Open it, choose Priority, discount 10, credit 2 months, threshold 5000000, category Strategic, then Approve & activate.', expect: 'Status: Activated, with a customer account and eligibility.' },
    ],
  },
  {
    id: 'booking', title: '2 · Book cargo and receive an AWB', summary: 'Approvals, frozen price, simulated payment, port verification and the AWB.',
    steps: [
      { persona: 'p-hoc', to: '/bookings/bk-0418', title: 'Head of Cargo verifies', text: 'Booking NRC-BK-2026-0418 (Lagoon Freight, Priority). Click “Verified — forward to Director”.', expect: 'Status: Pending Director Review.' },
      { persona: 'p-dir', to: '/bookings/bk-0418', title: 'Director sets discount and terms', text: 'Try 12% (refused — the eligible maximum is 10%). Set 8%, give a reason, choose “Payment link now”, then Approve & freeze price and confirm.', expect: 'Status: Awaiting Payment. The approved price is frozen.' },
      { persona: 'p-fac-priority', to: '/bookings/bk-0418', title: 'Customer pays (simulated)', text: 'Click “Payment fails”, then “Pay successfully”.', expect: 'Status: Pending Dispatch.' },
      { persona: 'p-hop', to: '/bookings/bk-0418', title: 'Head of Port dispatches', text: 'Tick the verification items, enter wagon, train, date and time, then “Approve dispatch & generate AWB”.', expect: 'Status: AWB Generated, with an AWB number.' },
      { persona: 'p-fac-priority', to: '/awbs', title: 'Customer views the AWB', text: 'Open the AWB. Its QR opens the verification page.', expect: 'A demonstration AWB with a QR code and version 1.' },
    ],
  },
  {
    id: 'rules', title: '3 · Pricing, eligibility and capacity rules', summary: 'Non-Priority pricing, missing rates, maintenance blocks and the waitlist.',
    steps: [
      { persona: 'p-fac-standard', to: '/bookings/new', title: 'Non-Priority price', text: 'Route Ebute Metta, 2 × 20ft, a date next month.', expect: 'No discount line. Total ₦197,550.00.' },
      { persona: 'p-fac-standard', to: '/bookings/new', title: 'No rate configured', text: 'Switch to Non-Containerized and route Moniya.', expect: 'The booking cannot be priced and cannot continue.' },
      { persona: 'p-fac-standard', to: '/bookings/new', title: 'Maintenance day and waitlist', text: 'Route Ebute Metta, date 30 Oct 2026.', expect: '“No slots” — and a button to join the waitlist (it is not a booking).' },
    ],
  },
  {
    id: 'exceptions', title: '4 · When things go wrong', summary: 'Send-back, failed physical check, refund and its reversal.',
    steps: [
      { persona: 'p-hoc', to: '/bookings/bk-0419', title: 'Send a booking back', text: 'Click Send back with the comment “Packing list does not match the invoice”.', expect: 'Status: Sent Back to Facilitator.' },
      { persona: 'p-fac-standard', to: '/bookings/bk-0419', title: 'Customer corrects and resubmits', text: 'Open “Correct & resubmit”, then Next, Next, tick the declaration and resubmit.', expect: 'Back to Pending Head of Cargo Review.' },
      { persona: 'p-hop', to: '/bookings/bk-0398', title: 'Physical check fails on a paid booking', text: 'Click “Physical check failed” and give a reason.', expect: 'Rejected — Physical Verification Failed, and a refund is started.' },
      { persona: 'p-dir', to: '/refunds', title: 'Director triggers the refund', text: 'Open the refund card and “Trigger refund link”.', expect: 'Refund link sent.' },
      { persona: 'p-fac-standard', to: '/refunds', title: 'Customer requests the refund', text: 'Open the refund, submit demo bank details and the exact amount.', expect: 'Status: Requested. Only a masked account is stored.' },
      { persona: 'p-sa', to: '/refunds', title: 'Super Admin processes it', text: 'Open the refund: Start review, Approve, Process. Optionally Reverse it.', expect: 'Processed (simulated) — a reversal adds a separate entry.' },
    ],
  },
  {
    id: 'admin', title: '5 · Super Admin, master data and audit', summary: 'Platform authority without business authority.',
    steps: [
      { persona: 'p-sa', to: '/staff', title: 'Manage staff accounts', text: 'Create an account, suspend one, reassign a role.', expect: 'Every action is audit-logged; no password is shown.' },
      { persona: 'p-sa', to: '/master-data', title: 'Rates, routes and capacity', text: 'Add a freight rate (a new dated row), set a capacity, add a maintenance block.', expect: 'Earlier rows are kept; approved prices are unaffected.' },
      { persona: 'p-sa', to: '/payments', title: 'Payment exceptions', text: 'Open the exception for ₦164,625 and match it to its invoice.', expect: 'The invoice moves to Pending Dispatch.' },
      { persona: 'p-dir', to: '/customers', title: 'Upgrade a customer', text: 'Open Apapa Gateway and change eligibility to Priority with a reason.', expect: 'Applies to future bookings only; approved bookings are unchanged.' },
      { persona: 'p-sa', to: '/audit', title: 'Audit log and export', text: 'Filter by actor role or date and Export CSV.', expect: 'A CSV of the filtered entries.' },
    ],
  },
]

export function DemoGuidePage() {
  const { switchPersona, resetDemo } = useStore()
  const navigate = useNavigate()
  const go = (s: Step) => { switchPersona(s.persona); navigate(s.to) }
  const who = (id: string) => { const p = personas.find((x) => x.id === id)!; return `${roleLabels[p.role]} · ${p.name}` }

  return (
    <>
      <PageHeader
        title="Demo guide"
        description="A suggested walk-through for stakeholders. Each “Go” button switches to the right role and opens the right page."
        actions={<Button variant="secondary" onClick={() => { resetDemo(); navigate('/demo-guide') }}><RotateCcw className="size-4" /> Reset demo data</Button>}
      />
      <div className="mb-6"><Notice title="Before you start">Click “Reset demo data” so the seeded records match these steps. Scenes can be shown in any order; within a scene, follow the steps in order. Everything is simulated — no payments, emails or integrations.</Notice></div>
      <div className="space-y-6">
        {scenes.map((scene) => (
          <Card key={scene.id}>
            <CardHeader title={scene.title} description={scene.summary} />
            <ol className="divide-y divide-slate-100">
              {scene.steps.map((s, i) => (
                <li key={s.title} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 max-w-2xl">
                    <p className="text-sm font-medium text-slate-900"><span className="mr-2 text-slate-400">{i + 1}.</span>{s.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-brand-700">{who(s.persona)}</p>
                    <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                    <p className="mt-1 text-xs text-slate-500"><span className="font-medium">Expect:</span> {s.expect}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => go(s)}>Go <ArrowRight className="size-3.5" /></Button>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </>
  )
}
