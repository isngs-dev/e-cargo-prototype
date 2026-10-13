import type {
  AppData,
  AuditEntry,
  District,
  Customer,
  CustomerCategory,
  CustomerEligibility,
  RegistrationApplication,
  RegistrationStatus,
  Role,
  UploadedDocument,
} from '@/types/domain'
import { naira } from '@/lib/money'
import { runRegistrationChecks, validateRegistration, type RegistrationInput } from '@/lib/registration'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Registration workflow (baseline §3, §9). Pure functions: (data, input) → new data or an error.
 * Every successful transition appends an audit entry. No emails are sent — they are noted as simulated.
 */

const DS_QUEUE: RegistrationStatus[] = ['pending_district_verification', 'sent_back_to_district']

function appendAudit(data: AppData, e: Omit<AuditEntry, 'id'>) {
  data.audit.push({ id: `au-${String(data.audit.length + 1).padStart(4, '0')}`, ...e })
}

function load(data: AppData, id: string, actor: Actor, role: Role, statuses: RegistrationStatus[], verb: string) {
  if (actor.role !== role) return fail(`Only the ${role.replace(/_/g, ' ')} can ${verb}.`)
  const next = structuredClone(data)
  const app = next.applications.find((a) => a.id === id)
  if (!app) return fail('Application not found.')
  if (role === 'district_supervisor' && actor.district !== app.district) return fail(`This application belongs to the ${app.district} district. You can only act on ${actor.district ?? 'your own'} district applications.`)
  if (!statuses.includes(app.status)) return fail(`Cannot ${verb}: application is "${app.status.replace(/_/g, ' ')}".`)
  return { next, app }
}

function move(next: AppData, app: RegistrationApplication, actor: Actor, to: RegistrationStatus, action: string, now: string, remarks?: string) {
  const from = app.status
  app.status = to
  app.updatedAt = now
  if (remarks) app.latestRemark = remarks
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'registration', entityId: app.id, entityRef: app.reference,
    action, fromStatus: from, toStatus: to, remarks,
  })
}

const required = (remarks: string | undefined, what: string) => (remarks?.trim() ? null : fail(`${what} requires remarks.`))

// ------------------------------------------------------------ Facilitator

export function submitRegistration(
  data: AppData, input: RegistrationInput, actor: Actor, now = new Date().toISOString(),
): WorkflowResult<{ applicationId: string }> {
  if (actor.role !== 'cargo_facilitator') return fail('Only a cargo facilitator can submit a registration.')
  const errors = validateRegistration(input, data.config.taxCertificateRequired)
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!)

  const next = structuredClone(data)
  const seq = next.counters.nextRegistrationSeq++
  const app: RegistrationApplication = {
    id: `reg-${seq}`, reference: `REG-2026-${String(seq).padStart(4, '0')}`, ...input,
    district: input.district as District, status: 'pending_district_verification', submittedAt: now, updatedAt: now, isDemo: true,
  }
  next.applications.push(app)
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'registration', entityId: app.id, entityRef: app.reference,
    action: 'Registration submitted', toStatus: app.status,
  })
  return { ok: true, data: next, applicationId: app.id }
}

export function resubmitRegistration(
  data: AppData, appId: string, input: RegistrationInput, actor: Actor, now = new Date().toISOString(),
): WorkflowResult<{ applicationId: string }> {
  if (actor.role !== 'cargo_facilitator' || actor.applicantAppId !== appId) return fail('You can only resubmit your own application.')
  const loaded = load(data, appId, actor, 'cargo_facilitator', ['sent_back_to_facilitator'], 'resubmit')
  if ('error' in loaded) return loaded
  const errors = validateRegistration(input, data.config.taxCertificateRequired)
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!)

  const { next, app } = loaded
  Object.assign(app, { ...input, district: input.district as District })
  move(next, app, actor, 'pending_district_verification', 'Registration corrected and resubmitted', now)
  return { ok: true, data: next, applicationId: app.id }
}

// ------------------------------------------------------------ District Supervisor

export function districtSendBack(data: AppData, appId: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = required(remarks, 'Sending back')
  if (r) return r
  const loaded = load(data, appId, actor, 'district_supervisor', DS_QUEUE, 'send back this application')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.app, actor, 'sent_back_to_facilitator', 'Sent back to facilitator (email simulated)', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

/** Incomplete documents block forwarding. Duplicate-CAC / blacklist flags are allowed but need an explanatory remark. */
export function districtForward(data: AppData, appId: string, actor: Actor, remarks = '', now = new Date().toISOString()): WorkflowResult {
  const loaded = load(data, appId, actor, 'district_supervisor', DS_QUEUE, 'forward this application')
  if ('error' in loaded) return loaded
  const { next, app } = loaded
  const checks = runRegistrationChecks(app, data.customers, data.applications, data.config.taxCertificateRequired)
  if (!checks.find((c) => c.key === 'incomplete_docs')!.passed) return fail('Documentation is incomplete — send the application back to the facilitator instead of forwarding.')
  const flagged = checks.filter((c) => !c.passed)
  if (flagged.length && !remarks.trim()) return fail(`Automated checks flagged: ${flagged.map((c) => c.label).join(', ')}. Add remarks explaining why the application is being forwarded.`)
  move(next, app, actor, 'pending_director_approval', 'Documents verified; forwarded to Director', now, remarks.trim() || undefined)
  return { ok: true, data: next }
}

// ------------------------------------------------------------ Director

export interface EligibilityInput {
  isPriority: boolean
  discountPct: number
  creditMonths: number
  thresholdNaira: number
  category: CustomerCategory | ''
}

export function validateEligibilityInput(i: EligibilityInput): string | null {
  if (!i.category) return 'Select a customer category.'
  if (!i.isPriority) return null
  if (!Number.isFinite(i.discountPct) || i.discountPct < 0 || i.discountPct > 100) return 'Eligible discount must be between 0% and 100%.'
  if (Math.round(i.discountPct * 100) !== i.discountPct * 100) return 'Eligible discount supports at most two decimal places.'
  if (!Number.isInteger(i.creditMonths) || i.creditMonths < 0 || i.creditMonths > 12) return 'Credit period must be a whole number of months (0–12).'
  if (!Number.isFinite(i.thresholdNaira) || i.thresholdNaira < 0) return 'Credit threshold cannot be negative.'
  if (i.creditMonths > 0 && i.thresholdNaira <= 0) return 'A credit threshold is required when a credit period is granted.'
  return null
}

export function toEligibility(i: EligibilityInput): CustomerEligibility {
  return i.isPriority
    ? { isPriority: true, eligibleDiscountBp: Math.round(i.discountPct * 100), eligibleCreditMonths: i.creditMonths, creditThreshold: i.creditMonths > 0 ? naira(i.thresholdNaira) : naira(i.thresholdNaira), category: i.category as CustomerCategory }
    : { isPriority: false, eligibleDiscountBp: 0, eligibleCreditMonths: 0, creditThreshold: 0, category: i.category as CustomerCategory }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function directorApprove(
  data: AppData, appId: string, actor: Actor, input: EligibilityInput, remarks = '', now = new Date().toISOString(),
): WorkflowResult<{ customerId: string; username: string }> {
  const loaded = load(data, appId, actor, 'director_operations', ['pending_director_approval'], 'approve this registration')
  if ('error' in loaded) return loaded
  const bad = validateEligibilityInput(input)
  if (bad) return fail(bad)

  const { next, app } = loaded
  const eligibility = toEligibility(input)
  const base = slug(app.companyName).slice(0, 16) || 'customer'
  let username = base
  for (let n = 2; next.customers.some((c) => c.username === username); n++) username = `${base}${n}`
  const customer: Customer = {
    id: `cus-${username}`, companyName: app.companyName, cacNumber: app.cacNumber, registeredAddress: app.registeredAddress, district: app.district,
    modes: app.modes, services: app.services, poc: app.poc, eligibility, accountStatus: 'active', activatedAt: now, username, isDemo: true,
  }
  next.customers.push(customer)
  app.customerId = customer.id

  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'customer', entityId: customer.id, entityRef: customer.companyName,
    action: 'Eligibility assigned at registration', remarks: remarks.trim() || undefined,
    change: {
      field: 'Eligibility',
      from: '—',
      to: `${eligibility.isPriority ? 'Priority' : 'Non-Priority'} · ${eligibility.category} · discount ${eligibility.eligibleDiscountBp / 100}% · credit ${eligibility.eligibleCreditMonths} mo`,
    },
  })
  move(next, app, actor, 'activated', 'Registration approved; credentials generated and emailed (simulated)', now, remarks.trim() || undefined)
  return { ok: true, data: next, customerId: customer.id, username }
}

export function directorReject(data: AppData, appId: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = required(remarks, 'Rejecting')
  if (r) return r
  const loaded = load(data, appId, actor, 'director_operations', ['pending_director_approval'], 'reject this registration')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.app, actor, 'rejected', 'Registration rejected (email simulated)', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

export function directorSendBack(data: AppData, appId: string, actor: Actor, remarks: string, now = new Date().toISOString()): WorkflowResult {
  const r = required(remarks, 'Sending back')
  if (r) return r
  const loaded = load(data, appId, actor, 'director_operations', ['pending_director_approval'], 'send back this registration')
  if ('error' in loaded) return loaded
  move(loaded.next, loaded.app, actor, 'sent_back_to_district', 'Sent back to District Supervisor', now, remarks.trim())
  return { ok: true, data: loaded.next }
}

// ------------------------------------------------------------ Internal remarks

export function addInternalRemark(data: AppData, appId: string, actor: Actor, remark: string, now = new Date().toISOString()): WorkflowResult {
  if (actor.role !== 'district_supervisor' && actor.role !== 'director_operations') return fail('Only NRC reviewers can add internal remarks.')
  if (!remark.trim()) return fail('Enter a remark.')
  const next = structuredClone(data)
  const app = next.applications.find((a) => a.id === appId)
  if (!app) return fail('Application not found.')
  if (actor.role === 'district_supervisor' && actor.district !== app.district) return fail(`This application belongs to the ${app.district} district.`)
  appendAudit(next, {
    at: now, actorName: actor.name, actorRole: actor.role, entityType: 'registration', entityId: app.id, entityRef: app.reference,
    action: 'Internal remark added', remarks: remark.trim(), internal: true,
  })
  return { ok: true, data: next }
}

export type { UploadedDocument }
