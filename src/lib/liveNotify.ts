import type { AppData, RegistrationApplication } from '@/types/domain'
import { buildMail, envelope } from '@/lib/mail'
import { roleLabels } from '@/lib/permissions'

/**
 * Live email + SMS. Every Mail Outbox message can also be delivered for real: customers and applicants at the address
 * and phone they typed, NRC officers at the contacts the presenter enters on the Live delivery setup page.
 * Seeded `.demo` addresses and their made-up phone numbers are never contacted. Sending goes through the small
 * notification service (`server/`), which holds the provider keys; with no service configured the app keeps simulating.
 */

export const LIVE_URL: string | undefined = (import.meta.env.VITE_NOTIFY_URL as string | undefined)?.replace(/\/$/, '') || undefined
export const liveConfigured = (): boolean => !!LIVE_URL

export type LiveKind = 'notification' | 'test' | 'registration_received' | 'registration_resubmitted' | 'registration_sent_back' | 'registration_approved' | 'registration_rejected'

export interface LiveNotice {
  /** Matches the id of the Mail Outbox message it mirrors, so the outbox can show it was also sent live. */
  id: string
  appId: string
  kind: LiveKind
  email: string
  phone: string
  name: string
  subject: string
  text: string
  sms: string
}

export type Channel = 'sent' | 'failed' | 'skipped' | 'pending'
export interface LiveDelivery { appId: string; kind: LiveKind; email: string; phone: string; emailStatus: Channel; smsStatus: Channel; at: string }

/** +234 and "0803 123 4567" → +2348031234567. */
export function toE164(countryCode: string, phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  return `${countryCode.replace(/\s/g, '')}${digits}`
}

const SMS_MAX = 300

/** Messages for the new registration audit entries between two states. Pure; nothing is sent here. */
export function registrationNotices(before: AppData, after: AppData, origin: string): LiveNotice[] {
  const apps = new Map(after.applications.map((a) => [a.id, a]))
  const out: LiveNotice[] = []
  for (const e of after.audit.slice(before.audit.length)) {
    if (e.entityType !== 'registration') continue
    const app = apps.get(e.entityId)
    if (!app) continue
    const track = `${origin}/track?ref=${app.reference}`
    const base = { appId: app.id, email: app.poc.email, phone: toE164(app.poc.countryCode, app.poc.phone), name: app.poc.name }
    const hello = (extra: string[]) => extra.join('\n\n')
    const cap = (s: string) => (s.length > SMS_MAX ? `${s.slice(0, SMS_MAX - 1)}…` : s)

    if (e.toStatus === 'pending_district_verification') {
      const again = /resubmit/i.test(e.action)
      out.push({
        ...base, id: `m-${e.id}`, kind: again ? 'registration_resubmitted' : 'registration_received',
        subject: `NRC e-Cargo — application ${app.reference} ${again ? 'resubmitted' : 'received'}`,
        text: hello([
          `We have ${again ? 'received your corrected application' : 'received your registration application'} for ${app.companyName}.`,
          `Reference: ${app.reference}\nDistrict: ${app.district}`,
          'Next step: the District Supervisor verifies your documents, then the Director of Operations decides. We will contact you at each stage.',
          `Track your application at any time: ${track}`,
        ]),
        sms: cap(`NRC e-Cargo: application ${app.reference} for ${app.companyName} ${again ? 'resubmitted' : 'received'}. Track: ${track}`),
      })
    } else if (e.toStatus === 'sent_back_to_facilitator') {
      out.push({
        ...base, id: `m-${e.id}`, kind: 'registration_sent_back',
        subject: `NRC e-Cargo — action needed on application ${app.reference}`,
        text: hello([
          `The District Supervisor needs a correction before your application for ${app.companyName} can continue.`,
          e.remarks ? `Comment: ${e.remarks}` : '',
          `Please sign in, correct the application and resubmit: ${origin}/login`,
        ].filter(Boolean)),
        sms: cap(`NRC e-Cargo: ${app.reference} needs a correction. See your email or track at ${track}`),
      })
    } else if (e.toStatus === 'activated') {
      const customer = after.customers.find((c) => c.id === app.customerId)
      out.push({
        ...base, id: `m-${e.id}-welcome`, kind: 'registration_approved',
        subject: `Welcome to NRC e-Cargo — ${app.companyName} is approved`,
        text: hello([
          `Your registration ${app.reference} has been approved by the Director of Operations. ${app.companyName} is now an active NRC e-Cargo customer${customer ? ` (${customer.eligibility.isPriority ? 'Priority' : 'Non-Priority'})` : ''}.`,
          `Sign in with your email address: ${app.poc.email}\nTemporary password: demo1234`,
          'For your security you will be asked to set your own password the first time you sign in.',
          `Sign in: ${origin}/login`,
        ]),
        sms: cap(`NRC e-Cargo: ${app.companyName} is approved. Sign-in details were sent to ${app.poc.email}. Sign in: ${origin}/login`),
      })
    } else if (e.toStatus === 'rejected') {
      out.push({
        ...base, id: `m-${e.id}`, kind: 'registration_rejected',
        subject: `NRC e-Cargo — application ${app.reference} not approved`,
        text: hello([`Your application for ${app.companyName} was not approved.`, e.remarks ? `Reason: ${e.remarks}` : ''].filter(Boolean)),
        sms: cap(`NRC e-Cargo: application ${app.reference} was not approved. See your email for the reason.`),
      })
    }
  }
  return out
}

export interface SendResult { email: Channel; sms: Channel }

/** Posts one notice to the notification service. Never throws: a network failure is reported as 'failed'. */
export async function sendLive(n: LiveNotice, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  if (!LIVE_URL) return { email: 'skipped', sms: 'skipped' }
  try {
    const res = await fetchImpl(`${LIVE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: n.kind, email: n.email, phone: n.phone, name: n.name, subject: n.subject, text: n.text, sms: n.sms }),
    })
    const body = (await res.json().catch(() => ({}))) as Partial<SendResult>
    return { email: body.email ?? 'failed', sms: body.sms ?? 'failed' }
  } catch {
    return { email: 'failed', sms: 'failed' }
  }
}

/** Plain-language line for the confirmation page and the Mail Outbox. */
export function deliveryLine(d: LiveDelivery): string {
  const part = (what: string, to: string, s: Channel) => (s === 'sent' ? `${what} sent to ${to}` : s === 'failed' ? `${what} to ${to} could not be sent` : s === 'pending' ? `sending ${what.toLowerCase()} to ${to}…` : '')
  return [part('Email', d.email, d.emailStatus), part('SMS', d.phone, d.smsStatus)].filter(Boolean).join(' · ')
}

export const applicationOf = (data: AppData, id: string): RegistrationApplication | undefined => data.applications.find((a) => a.id === id)

// ---------------------------------------------------------------- presenter settings (this browser only, survives Reset demo)

export interface LiveContact { email: string; phone: string }
/** `inbox`: one team mailbox that receives every message meant for a seeded `.demo` person, tagged with who it was for. */
export interface LiveSettings { emailOn: boolean; smsOn: boolean; inbox: string; contacts: Record<string, LiveContact> }
const SETTINGS_KEY = 'nrc-ecargo-prototype:live-settings'
export const DEFAULT_INBOX: string = ((import.meta.env.VITE_DEMO_INBOX as string | undefined) ?? '').trim()
export const defaultLiveSettings = (): LiveSettings => ({ emailOn: true, smsOn: true, inbox: DEFAULT_INBOX, contacts: {} })
const norm = (e: string) => e.trim().toLowerCase()

export function loadLiveSettings(): LiveSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<LiveSettings> | null
    return { ...defaultLiveSettings(), ...(raw ?? {}), inbox: raw?.inbox ?? DEFAULT_INBOX, contacts: { ...(raw?.contacts ?? {}) } }
  } catch { return defaultLiveSettings() }
}
export function saveLiveSettings(s: LiveSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* private mode: settings last for this page only */ }
}

/** Seeded demo addresses are not real mailboxes. */
export const isDemoAddress = (email: string): boolean => /\.demo$/i.test(norm(email))

function phoneFor(email: string, data: AppData): string {
  const poc = data.customers.find((c) => norm(c.poc.email) === norm(email))?.poc ?? data.applications.find((a) => norm(a.poc.email) === norm(email))?.poc
  return poc ? toE164(poc.countryCode, poc.phone) : ''
}

/** Who an in-app address belongs to, for tagging demo-inbox copies: "Director of Operations — Aliyu Bello". */
export function whoIs(email: string, data: AppData): string {
  const s = data.staff.find((x) => norm(x.email) === norm(email))
  if (s) return `${roleLabels[s.role]}${s.district ? ` (${s.district})` : ''} — ${s.name}`
  const c = data.customers.find((x) => norm(x.poc.email) === norm(email))
  if (c) return `${c.companyName} — ${c.poc.name}`
  const a = data.applications.find((x) => norm(x.poc.email) === norm(email))
  return a ? `${a.companyName} — ${a.poc.name}` : email
}

/**
 * Email and phone to use for one in-app address. Real addresses are used as typed; a presenter-entered contact wins;
 * a seeded `.demo` address goes to the demo inbox (with `forLabel` saying who it was for), or nowhere if none is set.
 */
export function contactFor(email: string, data: AppData, settings: LiveSettings): LiveContact & { forLabel?: string } {
  const set = settings.contacts[norm(email)]
  const demo = isDemoAddress(email)
  const realEmail = set?.email.trim() || (demo ? '' : norm(email))
  const phone = set?.phone.trim() || (demo ? '' : phoneFor(email, data))
  if (realEmail || !demo || !settings.inbox.trim()) return { email: realEmail, phone }
  return { email: settings.inbox.trim(), phone, forLabel: whoIs(email, data) }
}

/** Points a notice at the resolved contact; demo-inbox copies say who they were meant for. */
function routed(n: LiveNotice, c: LiveContact & { forLabel?: string }, original: string): LiveNotice {
  if (!c.forLabel) return { ...n, email: c.email, phone: c.phone }
  return {
    ...n, email: c.email, phone: c.phone, name: c.forLabel,
    subject: `[For ${c.forLabel}] ${n.subject}`.slice(0, 150),
    text: `Demo copy — this message was addressed to ${c.forLabel} <${original}>.\n\n${n.text}`.slice(0, 2000),
  }
}

/** Every new Mail Outbox message, expanded to one notice per real recipient (To and Cc). */
export function mailNotices(before: AppData, after: AppData, origin: string, settings: LiveSettings): LiveNotice[] {
  const seen = new Set(buildMail(before).map((m) => m.id))
  const registrationIds = new Map(registrationNotices(before, after, origin).map((n) => [n.id, norm(n.email)]))
  const out: LiveNotice[] = []
  for (const m of buildMail(after)) {
    if (seen.has(m.id)) continue
    const env = envelope(m, after)
    const direct = new Set(env.to.map((a) => norm(a.email)))
    for (const a of [...env.to, ...env.cc]) {
      if (registrationIds.get(m.id) === norm(a.email)) continue // the applicant's own registration message is built above
      const c = contactFor(a.email, after, settings)
      if (!c.email && !c.phone) continue
      const lines = m.body.filter((l) => !l.startsWith('This is a simulated email'))
      out.push(routed({
        id: `${m.id}|${norm(a.email)}`, appId: m.entityId, kind: 'notification', email: '', phone: '', name: a.name,
        subject: `NRC e-Cargo — ${m.subject}`,
        text: [...lines, direct.has(norm(a.email)) ? '' : 'You are receiving this message as a copy.', m.link ? `Open: ${origin}${m.link}` : ''].filter(Boolean).join('\n\n'),
        sms: `NRC e-Cargo: ${m.subject}`.slice(0, SMS_MAX),
      }, c, a.email))
    }
  }
  return out
}

/** Everything to deliver after one successful action, with the presenter's email / SMS switches applied. */
export function pendingLive(before: AppData, after: AppData, origin: string, settings: LiveSettings): LiveNotice[] {
  // Seeded applicants are not real people: their copies go to the demo inbox (or nowhere) like any other `.demo` address.
  const own = registrationNotices(before, after, origin).flatMap((n) => {
    if (!isDemoAddress(n.email)) return [n]
    const c = contactFor(n.email, after, settings)
    return c.email || c.phone ? [routed(n, c, n.email)] : []
  })
  return [...own, ...mailNotices(before, after, origin, settings)]
    .map((n) => ({ ...n, email: settings.emailOn ? n.email : '', phone: settings.smsOn ? n.phone : '' }))
    .filter((n) => n.email || n.phone)
}

export interface Health { configured: { email: boolean; sms: boolean }; smsBalance: string | null }
export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<Health | null> {
  if (!LIVE_URL) return null
  try { return (await (await fetchImpl(`${LIVE_URL}/api/health`)).json()) as Health } catch { return null }
}
