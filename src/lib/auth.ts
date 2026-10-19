import { findPersona, personas } from '@/data/personas'
import type { AppData, Customer, Persona } from '@/types/domain'

/**
 * Demonstration sign-in. These are PUBLISHED demo credentials shown on the login page — not real authentication.
 * Production would use a real identity provider (open item in docs/DECISIONS.md).
 */
export const DEMO_PASSWORD = 'demo1234'

export interface DemoAccount {
  personaId: string
  username: string
  password: string
  /** The post shown on the login page. */
  label: string
}

/** Order here is the order shown on the login page. Only the main demo accounts are listed. */
export const demoAccounts: DemoAccount[] = [
  { personaId: 'p-fac-priority', username: 'adaeze', password: DEMO_PASSWORD, label: 'Cargo Facilitator (Priority)' },
  { personaId: 'p-fac-standard', username: 'ibrahim', password: DEMO_PASSWORD, label: 'Cargo Facilitator (Non-Priority)' },
  { personaId: 'p-ds', username: 'c.obi', password: DEMO_PASSWORD, label: 'District Supervisor (Lagos)' },
  { personaId: 'p-ds-ibadan', username: 'o.adeyemi', password: DEMO_PASSWORD, label: 'District Supervisor (Ibadan)' },
  { personaId: 'p-hoc', username: 'f.adebayo', password: DEMO_PASSWORD, label: 'Head of Cargo' },
  { personaId: 'p-dir', username: 'a.bello', password: DEMO_PASSWORD, label: 'Director of Operations' },
  { personaId: 'p-md', username: 'n.adekunle', password: DEMO_PASSWORD, label: 'Managing Director' },
  { personaId: 'p-hop', username: 'g.etim', password: DEMO_PASSWORD, label: 'Head of Port Operations' },
  { personaId: 'p-sa', username: 't.bakare', password: DEMO_PASSWORD, label: 'Super Admin' },
]

/** Returns the persona id for valid credentials, otherwise null. Usernames are not case-sensitive. */
export function authenticate(username: string, password: string): string | null {
  const u = username.trim().toLowerCase()
  const account = demoAccounts.find((a) => a.username === u)
  return account && account.password === password ? account.personaId : null
}

/** Companies that registered through the public form (created at Director approval) — each has its own facilitator login. */
export const registeredCompanies = (data: AppData): Customer[] => data.customers.filter((c) => c.firstLogin !== undefined)

/** The facilitator account of a registered company: the contact person, acting for the company. */
export function companyPersona(c: Customer): Persona {
  return { id: `p-cus-${c.id}`, name: c.poc.name, role: 'cargo_facilitator', title: `${c.companyName} · ${c.eligibility.isPriority ? 'Priority' : 'Non-Priority'}`, customerId: c.id }
}

/** The company created for the demo applicant, once the Director has activated the application. */
export function applicantCompany(data: AppData, applicantAppId: string) {
  const app = data.applications.find((a) => a.id === applicantAppId)
  return app?.status === 'activated' && app.customerId ? data.customers.find((c) => c.id === app.customerId) : undefined
}

/** The password a username must present: the one the customer chose, otherwise the temporary one. */
export const expectedPassword = (username: string, passwords: Record<string, string>) => passwords[username.trim().toLowerCase()] ?? DEMO_PASSWORD

/**
 * A customer company signs in with its contact email address (as in its welcome email) and its password: the temporary one
 * until it sets its own at first sign-in. A company registered in this browser signs in as its own contact person.
 */
export function authenticateCustomer(username: string, password: string, data: AppData, passwords: Record<string, string> = {}): string | null {
  const u = username.trim().toLowerCase()
  const c = data.customers.find((x) => x.poc.email.toLowerCase() === u || x.username === u)
  if (!c || password !== expectedPassword(c.username, passwords)) return null
  const seeded = personas.find((x) => x.customerId === c.id)
  if (seeded) return seeded.id
  return c.firstLogin !== undefined ? companyPersona(c).id : null
}

/**
 * The persona actually in use. The demo applicant becomes an active facilitator of the new company
 * as soon as the Director has activated their application — same login, now with bookings.
 */
export function resolvePersona(persona: Persona, data: AppData, applicantAppId: string): Persona {
  if (!persona.isApplicant) return persona
  const app = data.applications.find((a) => a.id === applicantAppId)
  const customer = app?.status === 'activated' && app.customerId ? data.customers.find((c) => c.id === app.customerId) : undefined
  if (!customer) return app ? { ...persona, name: app.poc.name, title: `${app.companyName} · registration in progress` } : persona
  return { ...companyPersona(customer), id: persona.id, isApplicant: false }
}

/** Any account by id, including the dynamic per-company facilitator accounts (`p-cus-…`). */
export function personaFor(id: string, data: AppData, applicantAppId: string): Persona {
  if (id.startsWith('p-cus-')) {
    const c = data.customers.find((x) => `p-cus-${x.id}` === id)
    if (c) return companyPersona(c)
  }
  return resolvePersona(findPersona(id), data, applicantAppId)
}
