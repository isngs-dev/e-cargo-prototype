import type { AppData, AuditEntry, District, Persona, Role } from '@/types/domain'
import { bookingStatusMeta, registrationStatusMeta } from '@/lib/status'
import { roleLabels } from '@/lib/permissions'
import { formatDateTime } from '@/lib/format'

/**
 * Simulated email. Nothing is ever sent: every message is DERIVED from the audit log, so each business
 * step (past and future) produces its email automatically, survives a refresh, and cannot disagree with the record.
 *
 * Rules (see docs/DECISIONS.md A-61 … A-63):
 *  - the person or team waiting on the next step is the primary recipient (customer, supervisor, Head of Cargo, Director, Head of Port, Super Admin);
 *  - the Managing Director and the Director are copied on every business stage;
 *  - Super Admin's Outbox shows every message the system sent.
 */

export type Recipient =
  | { kind: 'role'; role: Role; district?: District }
  | { kind: 'customer'; customerId: string }
  | { kind: 'applicant'; appId: string }

export interface MailMessage {
  id: string
  at: string
  entityType: AuditEntry['entityType']
  entityId: string
  entityRef: string
  /** In-app page the message refers to. */
  link?: string
  subject: string
  body: string[]
  to: Recipient[]
  cc: Recipient[]
  actorName: string
}

export const SENDER = 'NRC e-Cargo <no-reply@ecargo.nrc.demo> (simulated)'

const role = (r: Role, district?: District): Recipient => ({ kind: 'role', role: r, ...(district ? { district } : {}) })
const sameRecipient = (a: Recipient, b: Recipient) => JSON.stringify(a) === JSON.stringify(b)

const refundLabels: Record<string, string> = {
  awaiting_director: 'Awaiting Director', link_sent: 'Refund link sent', requested: 'Requested', under_review: 'Under review', approved: 'Approved', processed: 'Processed',
}

function statusLabel(e: AuditEntry, s: string | undefined): string | undefined {
  if (!s) return undefined
  if (e.entityType === 'booking') return bookingStatusMeta[s as keyof typeof bookingStatusMeta]?.label ?? s.replace(/_/g, ' ')
  if (e.entityType === 'registration') return registrationStatusMeta[s as keyof typeof registrationStatusMeta]?.label ?? s.replace(/_/g, ' ')
  if (e.entityType === 'refund') return refundLabels[s] ?? s.replace(/_/g, ' ')
  return s.replace(/_/g, ' ')
}

const NEXT: Record<string, string> = {
  'registration:pending_district_verification': 'The District Supervisor verifies the documents.',
  'registration:pending_director_approval': 'The Director of Operations sets eligibility and decides.',
  'registration:sent_back_to_facilitator': 'The applicant corrects the application and resubmits.',
  'registration:sent_back_to_district': 'The District Supervisor re-checks and forwards it again.',
  'registration:activated': 'The company can sign in and create bookings.',
  'registration:rejected': 'No further action. The applicant may apply again.',
  'booking:pending_hoc_review': 'Head of Cargo verifies the documents and cargo.',
  'booking:pending_director_review': 'The Director sets the final discount and payment terms.',
  'booking:sent_back_to_facilitator': 'The customer corrects the booking and resubmits.',
  'booking:sent_back_to_hoc': 'Head of Cargo re-checks and forwards it again.',
  'booking:awaiting_payment': 'The customer pays through the payment link (simulated).',
  'booking:credit_approved': 'Head of Port can dispatch; payment falls due at the end of the credit period.',
  'booking:pending_dispatch': 'Head of Port verifies the cargo and dispatches it.',
  'booking:awb_generated': 'The cargo moves; Head of Port marks it complete on delivery.',
  'booking:completed': 'The booking is complete.',
  'booking:rejected_hoc': 'No further action on this booking.',
  'booking:rejected_director': 'No further action on this booking.',
  'booking:auto_cancelled': 'No further action; the payment window passed.',
  'booking:rejected_physical': 'A refund starts if payment had been received.',
  'refund:awaiting_director': 'The Director triggers the refund link.',
  'refund:link_sent': 'The customer submits the refund request.',
  'refund:requested': 'Super Admin starts the review.',
  'refund:under_review': 'Super Admin approves the refund.',
  'refund:approved': 'Super Admin processes the refund (simulated).',
  'refund:processed': 'The refund is complete (simulated).',
}

/** Business stages that generate email. Staff and master-data administration do not. */
const MAILED: AuditEntry['entityType'][] = ['registration', 'booking', 'refund', 'payment', 'customer']

/**
 * Entries without a status change are routine detail, not email: photos, internal remarks, pricing / term detail,
 * waitlist, record edits, and the invoice line that repeats the approval. Status changes and security notices are mailed.
 */
const NOT_MAILED = /^(Container photo|Payment terms selected|Discount granted|Internal remark|Eligibility assigned|Customer record corrected|Joined the waitlist|Invoice generated|Credit period started)/
export const isMailable = (e: AuditEntry): boolean => MAILED.includes(e.entityType) && (!!e.toStatus || !NOT_MAILED.test(e.action))

export function buildMail(data: AppData): MailMessage[] {
  const apps = new Map(data.applications.map((a) => [a.id, a]))
  const bookings = new Map(data.bookings.map((b) => [b.id, b]))
  const refunds = new Map(data.refunds.map((r) => [r.id, r]))
  const out: MailMessage[] = []

  for (const e of data.audit) {
    if (!isMailable(e)) continue
    let primary: Recipient[] = []
    let link: string | undefined

    if (e.entityType === 'registration') {
      const app = apps.get(e.entityId)
      const ds = role('district_supervisor', app?.district)
      const applicant: Recipient = { kind: 'applicant', appId: e.entityId }
      link = `/registrations/${e.entityId}`
      switch (e.toStatus) {
        case 'pending_district_verification': primary = [applicant, ds]; break
        case 'sent_back_to_facilitator': primary = [applicant]; break
        case 'pending_director_approval': primary = [applicant, role('director_operations')]; break
        case 'sent_back_to_district': primary = [ds]; break
        case 'activated': primary = [ds]; break
        case 'rejected': primary = [applicant, ds]; break
        default: primary = e.internal ? [] : [applicant]
      }
    } else if (e.entityType === 'booking') {
      const b = bookings.get(e.entityId)
      const customer: Recipient[] = b ? [{ kind: 'customer', customerId: b.customerId }] : []
      link = `/bookings/${e.entityId}`
      switch (e.toStatus) {
        case 'pending_hoc_review': primary = [...customer, role('head_of_cargo')]; break
        case 'sent_back_to_facilitator': primary = customer; break
        case 'pending_director_review': primary = [...customer, role('director_operations')]; break
        case 'sent_back_to_hoc': primary = [role('head_of_cargo')]; break
        case 'awaiting_payment': case 'credit_approved': case 'completed': case 'rejected_hoc': case 'rejected_director': case 'auto_cancelled': primary = customer; break
        case 'pending_dispatch': primary = [...customer, role('head_port_operations')]; break
        case 'awb_generated': primary = [...customer, role('head_of_cargo'), role('director_operations'), role('head_port_operations')]; break
        case 'rejected_physical': primary = [...customer, role('director_operations')]; break
        default:
          // Internal notes and pricing detail go to NRC reviewers only; everything else informs the customer.
          primary = e.internal || /^Discount granted|^Payment terms selected/.test(e.action) ? [] : customer
      }
    } else if (e.entityType === 'refund') {
      const r = refunds.get(e.entityId)
      const customer: Recipient[] = r ? [{ kind: 'customer', customerId: r.customerId }] : []
      link = `/refunds/${e.entityId}`
      switch (e.toStatus) {
        case 'awaiting_director': primary = [role('director_operations')]; break
        case 'requested': primary = [role('super_admin')]; break
        case 'processed': primary = [...customer, role('director_operations')]; break
        default: primary = customer
      }
    } else if (e.entityType === 'payment') {
      primary = [role('super_admin')]
      link = e.entityId.startsWith('px-') ? `/payments/${e.entityId}` : undefined
    } else if (e.entityType === 'customer') {
      primary = [{ kind: 'customer', customerId: e.entityId }]
      link = `/customers/${e.entityId}`
    }

    // Security notices (password changes) go to the account holder only.
    const cc = /^Password changed/.test(e.action) ? [] : [role('managing_director'), role('director_operations')].filter((c) => !primary.some((p) => sameRecipient(p, c)))
    // Approval-stage remarks and discount reasons are for NRC reviewers; the customer's email never repeats them.
    const hideRemarks = e.entityType === 'booking' && (e.toStatus === 'awaiting_payment' || e.toStatus === 'credit_approved')
    const from = statusLabel(e, e.fromStatus)
    const to = statusLabel(e, e.toStatus)
    const body = [
      `${e.action}.`,
      ...(to ? [`Status: ${from ? `${from} → ` : ''}${to}.`] : []),
      ...(e.toStatus && NEXT[`${e.entityType}:${e.toStatus}`] ? [`Next step: ${NEXT[`${e.entityType}:${e.toStatus}`]}`] : []),
      ...(e.remarks && !hideRemarks ? [`Remarks: ${e.remarks}`] : []),
      ...(e.change ? [`Changed: ${e.change.field} — ${e.change.from} → ${e.change.to}.`] : []),
      `Recorded by ${e.actorName}${e.actorRole === 'system' ? '' : ` (${roleLabels[e.actorRole]})`} on ${formatDateTime(e.at)}.`,
      'This is a simulated email. Nothing was sent; it is generated from the audit log for demonstration.',
    ]
    if (e.entityType === 'registration' && e.toStatus === 'activated') {
      const app = apps.get(e.entityId)
      const customer = app?.customerId ? data.customers.find((c) => c.id === app.customerId) : undefined
      if (app && customer) {
        out.push({
          id: `m-${e.id}-welcome`, at: e.at, entityType: e.entityType, entityId: e.entityId, entityRef: e.entityRef, link: '/login',
          subject: `Welcome to NRC e-Cargo — your account for ${customer.companyName} is active`,
          body: [
            `Your registration ${app.reference} has been approved by the Director of Operations and your company account is now active.`,
            `Customer status: ${customer.eligibility.isPriority ? 'Priority' : 'Non-Priority'} · Category: ${customer.eligibility.category}.`,
            `Sign-in email: ${customer.poc.email}`,
            `Temporary password: ${'demo1234'}`,
            'For your security you will be asked to set your own password the first time you sign in.',
            'Next step: sign in to NRC e-Cargo with the email address and temporary password above, set your new password, then create your first booking.',
            'This is a simulated email. Nothing was sent; it is generated from the audit log for demonstration.',
          ],
          to: [{ kind: 'applicant', appId: e.entityId }], cc: [], actorName: e.actorName,
        })
      }
    }
    out.push({
      id: `m-${e.id}`, at: e.at, entityType: e.entityType, entityId: e.entityId, entityRef: e.entityRef, link,
      subject: `${e.entityRef} — ${e.action}`, body, to: primary, cc, actorName: e.actorName,
    })
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

// ---------------------------------------------------------------- who sees what

export interface Reader { persona: Persona; applicantAppId: string }

export function isRecipient(r: Recipient, who: Reader): boolean {
  if (r.kind === 'role') return who.persona.role === r.role && (!r.district || who.persona.district === r.district)
  if (r.kind === 'customer') return who.persona.customerId === r.customerId
  return who.persona.id === 'p-fac-applicant' && who.applicantAppId === r.appId
}

export const inboxFor = (messages: MailMessage[], who: Reader) => messages.filter((m) => [...m.to, ...m.cc].some((r) => isRecipient(r, who)))

/** Why this reader got the message: addressed directly, or copied. */
export const isCopy = (m: MailMessage, who: Reader) => !m.to.some((r) => isRecipient(r, who))

export function recipientLabel(r: Recipient, data: AppData): string {
  if (r.kind === 'role') return `${roleLabels[r.role]}${r.district ? ` (${r.district})` : ''}`
  if (r.kind === 'customer') {
    const c = data.customers.find((x) => x.id === r.customerId)
    return c ? `${c.poc.name} · ${c.companyName}` : 'Customer'
  }
  const a = data.applications.find((x) => x.id === r.appId)
  return a ? `${a.poc.name} · ${a.companyName} (applicant)` : 'Applicant'
}

// ---------------------------------------------------------------- read state

export interface MailState {
  /** Everything at or before this moment is history and counts as read. */
  epoch: string
  /** Per account: ids opened. */
  read: Record<string, string[]>
  /** Per account: "mark all as read" moment. */
  seenUntil: Record<string, string>
}

export const emptyMailState = (epoch: string): MailState => ({ epoch, read: {}, seenUntil: {} })

/** `key` is a persona id (in-app notifications) or an email address (Mail Outbox). */
export function isUnread(m: MailMessage, key: string, s: MailState): boolean {
  const cutoff = Math.max(Date.parse(s.epoch), Date.parse(s.seenUntil[key] ?? s.epoch))
  return Date.parse(m.at) > cutoff && !(s.read[key] ?? []).includes(m.id)
}

// ---------------------------------------------------------------- mailboxes (Mail Outbox — simple simulated mailbox viewer)

/** The platform's sending address. Signing in to this mailbox shows every message sent (the outbox). */
export const SYSTEM_ADDRESS = 'no-reply@ecargo.nrc.demo'
export const MAIL_PASSWORD = 'demo1234'

export interface Address { name: string; email: string }

const norm = (e: string) => e.trim().toLowerCase()

/** Real addresses behind a recipient: active staff in that role (and district), or the company / applicant contact. */
export function addressesOf(r: Recipient, data: AppData): Address[] {
  if (r.kind === 'role') {
    return data.staff
      .filter((s) => s.role === r.role && (!r.district || s.district === r.district) && (s.status === 'active' || s.status === 'pending_first_login'))
      .map((s) => ({ name: s.name, email: s.email }))
  }
  if (r.kind === 'customer') {
    const c = data.customers.find((x) => x.id === r.customerId)
    return c ? [{ name: c.poc.name, email: c.poc.email }] : []
  }
  const a = data.applications.find((x) => x.id === r.appId)
  return a ? [{ name: a.poc.name, email: a.poc.email }] : []
}

export function envelope(m: MailMessage, data: AppData): { to: Address[]; cc: Address[] } {
  const uniq = (list: Address[]) => list.filter((a, i) => list.findIndex((b) => norm(b.email) === norm(a.email)) === i)
  const to = uniq(m.to.flatMap((r) => addressesOf(r, data)))
  const cc = uniq(m.cc.flatMap((r) => addressesOf(r, data))).filter((a) => !to.some((t) => norm(t.email) === norm(a.email)))
  return { to, cc }
}

/** Messages in one mailbox. The system mailbox holds every message sent. */
export function mailboxMessages(messages: MailMessage[], email: string, data: AppData): MailMessage[] {
  if (norm(email) === SYSTEM_ADDRESS) return messages
  return messages.filter((m) => {
    const env = envelope(m, data)
    return [...env.to, ...env.cc].some((a) => norm(a.email) === norm(email))
  })
}

export const isCopyFor = (m: MailMessage, email: string, data: AppData) => norm(email) !== SYSTEM_ADDRESS && !envelope(m, data).to.some((a) => norm(a.email) === norm(email))

export interface Mailbox { email: string; name: string; group: 'NRC staff' | 'Customers' | 'Platform'; label: string }

/**
 * Mailboxes offered on the Mail Outbox page: NRC staff, the two demo customers, any company that registered
 * in this browser (its contact email, whatever was typed), and the platform's sending mailbox.
 */
export function mailboxes(data: AppData, applicantAppId: string): Mailbox[] {
  const order = ['district_supervisor', 'head_of_cargo', 'director_operations', 'managing_director', 'head_port_operations', 'super_admin']
  const staff: Mailbox[] = data.staff
    .filter((s) => s.status === 'active')
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .map((s) => ({ email: s.email, name: s.name, group: 'NRC staff', label: `${roleLabels[s.role]}${s.district ? ` (${s.district})` : ''}` }))
  const customers: Mailbox[] = []
  for (const id of ['cus-lagoon', 'cus-gateway']) {
    const c = data.customers.find((x) => x.id === id)
    if (c) customers.push({ email: c.poc.email, name: c.poc.name, group: 'Customers', label: `${c.companyName} (${c.eligibility.isPriority ? 'Priority' : 'Non-Priority'})` })
  }
  for (const a of data.applications.filter((x) => x.id === applicantAppId || /^reg-\d+$/.test(x.id))) {
    if (!customers.some((c) => norm(c.email) === norm(a.poc.email))) customers.push({ email: a.poc.email, name: a.poc.name, group: 'Customers', label: `${a.companyName} (new company)` })
  }
  return [...staff, ...customers, { email: SYSTEM_ADDRESS, name: 'NRC e-Cargo system', group: 'Platform', label: 'Sent mail (outbox)' }]
}

/** Mail Outbox sign-in: a known mailbox and the demo password. Returns the normalised address or null. */
export function mailSignIn(email: string, password: string, data: AppData, applicantAppId: string): string | null {
  const e = norm(email)
  if (password !== MAIL_PASSWORD) return null
  const known = mailboxes(data, applicantAppId).some((m) => norm(m.email) === e)
    || data.customers.some((c) => norm(c.poc.email) === e) || data.applications.some((a) => norm(a.poc.email) === e)
  return known ? e : null
}
