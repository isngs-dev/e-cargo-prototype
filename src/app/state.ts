import type { AppData } from '@/types/domain'
import * as seed from '@/data/seed'
import { emptyMailState, type MailState } from '@/lib/mail'

export interface AppState {
  version: number
  /** Signed-in demo account, or null when signed out. */
  personaId: string | null
  /** Registration application tracked by the demo applicant persona. */
  applicantAppId: string
  /** Mail Outbox (simulated mailbox viewer): signed-in mailbox, and what each mailbox has opened. */
  mailUser: string | null
  /** Passwords customers chose at first sign-in (demo only, kept in this browser). Everyone else uses the published demo password. */
  passwords: Record<string, string>
  mail: MailState
  /** In-app notification bell: what each account has seen. Mail and notifications are derived from the audit log. */
  notifications: MailState
  data: AppData
}

/** The demo applicant starts with no application, so the journey begins at the registration form. */
export const DEFAULT_APPLICANT_APP_ID = ''

export function createSeedData(): AppData {
  return structuredClone({
    customers: seed.customers,
    applications: seed.applications,
    bookings: seed.bookings,
    routes: seed.routes,
    freightRates: seed.freightRates,
    staff: seed.staff,
    audit: seed.audit,
    refunds: seed.refunds,
    paymentExceptions: seed.paymentExceptions,
    config: seed.config,
    capacity: seed.capacity,
    maintenanceBlocks: seed.maintenanceBlocks,
    waitlist: seed.waitlist,
    refundReversals: seed.refundReversals,
    counters: seed.counters,
  })
}

/** History (seeded and earlier) counts as read; only mail from new actions is unread. */
function mailEpoch(): string {
  const latest = seed.audit.reduce((m, e) => Math.max(m, Date.parse(e.at)), 0)
  return new Date(Math.max(Date.now(), latest)).toISOString()
}

export function createSeedState(personaId: string | null = null, mailUser: string | null = null): AppState {
  const epoch = mailEpoch()
  return { version: seed.SEED_VERSION, personaId, applicantAppId: DEFAULT_APPLICANT_APP_ID, mailUser, passwords: {}, mail: emptyMailState(epoch), notifications: emptyMailState(epoch), data: createSeedData() }
}
