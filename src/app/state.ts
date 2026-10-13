import type { AppData } from '@/types/domain'
import * as seed from '@/data/seed'
import { DEFAULT_PERSONA_ID } from '@/data/personas'

export interface AppState {
  version: number
  personaId: string
  /** Registration application tracked by the demo applicant persona. */
  applicantAppId: string
  data: AppData
}

export const DEFAULT_APPLICANT_APP_ID = 'reg-marina'

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
    counters: seed.counters,
  })
}

export function createSeedState(personaId = DEFAULT_PERSONA_ID): AppState {
  return { version: seed.SEED_VERSION, personaId, applicantAppId: DEFAULT_APPLICANT_APP_ID, data: createSeedData() }
}
