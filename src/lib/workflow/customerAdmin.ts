import type { AppData, Customer, CustomerAccountStatus } from '@/types/domain'
import { formatBp, formatKobo } from '@/lib/money'
import { appendAudit } from './audit'
import { toEligibility, validateEligibilityInput, type EligibilityInput } from './registration'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Customer administration (baseline §2.2, §6.3, §10).
 * - Director and Super Admin may suspend / blacklist / reactivate a customer (reason required, audited).
 * - Only the Director changes eligibility (upgrade, downgrade, discount, credit) — Super Admin cannot (§2.3, open item D-14).
 * - Super Admin may correct non-commercial record fields (address / contact).
 * Eligibility changes apply to FUTURE bookings only: approved bookings hold a frozen price and an eligibility snapshot.
 */

const describe = (c: Customer) => {
  const e = c.eligibility
  return `${e.isPriority ? 'Priority' : 'Non-Priority'} · ${e.category} · discount ${formatBp(e.eligibleDiscountBp)} · credit ${e.eligibleCreditMonths} mo · threshold ${formatKobo(e.creditThreshold)}`
}

function load(data: AppData, id: string) {
  const next = structuredClone(data)
  const customer = next.customers.find((c) => c.id === id)
  return { next, customer }
}

export function setCustomerAccountStatus(data: AppData, id: string, status: CustomerAccountStatus, reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'director_operations' && actor.role !== 'super_admin' && actor.role !== 'managing_director') return fail('Only the Managing Director, Director or Super Admin can change a customer’s account status.')
  if (!reason.trim()) return fail('A reason is required.')
  const { next, customer } = load(data, id)
  if (!customer) return fail('Customer not found.')
  if (customer.accountStatus === status) return fail(`The account is already ${status}.`)
  const from = customer.accountStatus
  customer.accountStatus = status
  const label = { active: 'Customer account reactivated', suspended: 'Customer account suspended', blacklisted: 'Customer blacklisted' }[status]
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'customer', entityId: customer.id, entityRef: customer.companyName,
    action: label, fromStatus: from, toStatus: status, remarks: reason.trim(),
  })
  return { ok: true, data: next }
}

export function changeCustomerEligibility(data: AppData, id: string, input: EligibilityInput, reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'director_operations') return fail('Only the Director of Operations can change a customer’s eligibility.')
  if (!reason.trim()) return fail('A reason is required.')
  const bad = validateEligibilityInput(input)
  if (bad) return fail(bad)
  const { next, customer } = load(data, id)
  if (!customer) return fail('Customer not found.')
  const before = describe(customer)
  customer.eligibility = toEligibility(input)
  const after = describe(customer)
  if (before === after) return fail('No change to save.')
  const upgrade = !data.customers.find((c) => c.id === id)!.eligibility.isPriority && customer.eligibility.isPriority
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'customer', entityId: customer.id, entityRef: customer.companyName,
    action: `${upgrade ? 'Customer upgraded to Priority' : 'Customer eligibility changed'} — applies to future bookings only; approved bookings are unaffected (customer notified, simulated)`,
    remarks: reason.trim(), change: { field: 'Eligibility', from: before, to: after },
  })
  return { ok: true, data: next }
}

export interface RecordCorrection { registeredAddress: string; pocName: string; pocEmail: string; pocCountryCode: string; pocPhone: string }

export function correctCustomerRecord(data: AppData, id: string, patch: RecordCorrection, reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'super_admin') return fail('Only Super Admin corrects customer records.')
  if (!reason.trim()) return fail('A reason is required.')
  if (patch.registeredAddress.trim().length < 5) return fail('Enter the registered address.')
  if (patch.pocName.trim().length < 2) return fail('Enter the point of contact’s name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.pocEmail.trim())) return fail('Enter a valid email address.')
  if (!/^\d{7,12}$/.test(patch.pocPhone.replace(/[\s-]/g, ''))) return fail('Enter 7–12 digits for the phone number.')
  const { next, customer } = load(data, id)
  if (!customer) return fail('Customer not found.')
  const before = `${customer.registeredAddress} · ${customer.poc.name} · ${customer.poc.email} · ${customer.poc.countryCode} ${customer.poc.phone}`
  customer.registeredAddress = patch.registeredAddress.trim()
  customer.poc = { name: patch.pocName.trim(), email: patch.pocEmail.trim(), countryCode: patch.pocCountryCode, phone: patch.pocPhone.trim() }
  const after = `${customer.registeredAddress} · ${customer.poc.name} · ${customer.poc.email} · ${customer.poc.countryCode} ${customer.poc.phone}`
  if (before === after) return fail('No change to save.')
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'customer', entityId: customer.id, entityRef: customer.companyName,
    action: 'Customer record corrected (address / contact)', remarks: reason.trim(), change: { field: 'Record', from: before, to: after },
  })
  return { ok: true, data: next }
}

/** The customer has set their own password at first sign-in (the password itself is never stored in the record or audit). */
export function completeFirstLogin(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'cargo_facilitator' || actor.customerId !== id) return fail('Only the customer’s own account can set its password.')
  const { next, customer } = load(data, id)
  if (!customer) return fail('Customer not found.')
  if (!customer.firstLogin) return fail('The password has already been changed.')
  customer.firstLogin = false
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'customer', entityId: customer.id, entityRef: customer.companyName,
    action: 'Password changed at first sign-in (simulated)',
  })
  return { ok: true, data: next }
}
