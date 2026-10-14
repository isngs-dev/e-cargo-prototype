import type { AppData, District, Role, StaffAccount } from '@/types/domain'
import { appendAudit } from './audit'
import { fail, type Actor, type WorkflowResult } from './result'

/**
 * Staff credential management (baseline §2.1) — Super Admin only, every action audited.
 * Credentials are simulated: no password is ever generated, shown or sent, and the role switcher
 * personas are not affected by changes made here.
 */

export type StaffRole = Exclude<Role, 'cargo_facilitator' | 'super_admin'>
export const STAFF_ROLES: StaffRole[] = ['district_supervisor', 'head_of_cargo', 'director_operations', 'head_port_operations']

export interface StaffInput {
  name: string
  email: string
  role: StaffRole
  /** Required for District Supervisors, ignored otherwise. */
  district?: District
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateStaff(input: StaffInput, existing: StaffAccount[], ignoreId?: string): string | null {
  if (input.name.trim().length < 2) return 'Enter the staff member’s name.'
  if (!EMAIL.test(input.email.trim())) return 'Enter a valid email address.'
  if (existing.some((s) => s.id !== ignoreId && s.email.toLowerCase() === input.email.trim().toLowerCase())) return 'A staff account with this email already exists.'
  if (!STAFF_ROLES.includes(input.role)) return 'Select a valid NRC role.'
  if (input.role === 'district_supervisor' && !input.district) return 'A District Supervisor must be assigned to a district (Lagos or Ibadan).'
  return null
}

function entry(next: AppData, actor: Actor, s: StaffAccount, action: string, now: string, extra: { remarks?: string; change?: { field: string; from: string; to: string }; toStatus?: string; fromStatus?: string } = {}) {
  appendAudit(next, { at: now, actorName: actor.name, actorRole: actor.role, entityType: 'staff', entityId: s.id, entityRef: s.name, action, ...extra })
}

function gate(actor: Actor) {
  return actor.role === 'super_admin' ? null : fail('Only Super Admin manages staff accounts.')
}

function loadStaff(data: AppData, id: string, actor: Actor) {
  const denied = gate(actor)
  if (denied) return denied
  const next = structuredClone(data)
  const staff = next.staff.find((s) => s.id === id)
  if (!staff) return fail('Staff account not found.')
  if (staff.role === 'super_admin') return fail('The Super Admin account cannot be changed here.')
  if (staff.status === 'revoked') return fail('This account has been revoked and cannot be changed.')
  return { next, staff }
}

export function createStaff(data: AppData, input: StaffInput, actor: Actor, now = new Date().toISOString()): WorkflowResult<{ staffId: string }> {
  const denied = gate(actor)
  if (denied) return denied
  const bad = validateStaff(input, data.staff)
  if (bad) return fail(bad)
  const next = structuredClone(data)
  const staff: StaffAccount = {
    id: `st-${next.staff.length + 1}-${input.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`,
    name: input.name.trim(), email: input.email.trim(), role: input.role, status: 'pending_first_login',
    district: input.role === 'district_supervisor' ? input.district : undefined,
  }
  next.staff.push(staff)
  entry(next, actor, staff, `Staff account created — ${input.role.replace(/_/g, ' ')}${staff.district ? ` (${staff.district})` : ''}; initial credentials issued by email (simulated), password change forced on first login`, now, { toStatus: staff.status })
  return { ok: true, data: next, staffId: staff.id }
}

export function updateStaffDetails(data: AppData, id: string, patch: { name: string; email: string }, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadStaff(data, id, actor)
  if ('error' in loaded) return loaded
  const { next, staff } = loaded
  const bad = validateStaff({ ...patch, role: staff.role as StaffRole, district: staff.district }, next.staff, staff.id)
  if (bad) return fail(bad)
  const before = `${staff.name} <${staff.email}>`
  staff.name = patch.name.trim()
  staff.email = patch.email.trim()
  entry(next, actor, staff, 'Staff details edited', now, { change: { field: 'Name / email', from: before, to: `${staff.name} <${staff.email}>` } })
  return { ok: true, data: next }
}

export function resetStaffPassword(data: AppData, id: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  const loaded = loadStaff(data, id, actor)
  if ('error' in loaded) return loaded
  const { next, staff } = loaded
  if (staff.status === 'suspended') return fail('Reactivate the account before resetting its password.')
  const from = staff.status
  staff.status = 'pending_first_login'
  entry(next, actor, staff, 'Password reset; temporary credentials issued by email (simulated), change forced on next login', now, { fromStatus: from, toStatus: staff.status })
  return { ok: true, data: next }
}

export function setStaffAccess(data: AppData, id: string, action: 'suspend' | 'reactivate' | 'revoke', reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (!reason.trim()) return fail('A reason is required.')
  const loaded = loadStaff(data, id, actor)
  if ('error' in loaded) return loaded
  const { next, staff } = loaded
  const from = staff.status
  if (action === 'suspend' && staff.status === 'suspended') return fail('The account is already suspended.')
  if (action === 'reactivate' && staff.status !== 'suspended') return fail('Only suspended accounts can be reactivated.')
  staff.status = action === 'suspend' ? 'suspended' : action === 'revoke' ? 'revoked' : 'active'
  const label = { suspend: 'Staff access suspended', reactivate: 'Staff access reactivated', revoke: 'Staff access revoked (permanent)' }[action]
  entry(next, actor, staff, label, now, { fromStatus: from, toStatus: staff.status, remarks: reason.trim() })
  return { ok: true, data: next }
}

/** Reassign the role (and district) held by an account, e.g. when NRC staff change. */
export function reassignStaffRole(data: AppData, id: string, role: StaffRole, district: District | undefined, reason: string, actor: Actor, now = new Date().toISOString()): WorkflowResult {
  if (!reason.trim()) return fail('A reason is required.')
  const loaded = loadStaff(data, id, actor)
  if ('error' in loaded) return loaded
  const { next, staff } = loaded
  const bad = validateStaff({ name: staff.name, email: staff.email, role, district }, next.staff, staff.id)
  if (bad) return fail(bad)
  const fmt = (r: string, d?: string) => `${r.replace(/_/g, ' ')}${d ? ` (${d})` : ''}`
  const from = fmt(staff.role, staff.district)
  staff.role = role
  staff.district = role === 'district_supervisor' ? district : undefined
  entry(next, actor, staff, 'Role reassigned', now, { remarks: reason.trim(), change: { field: 'Role', from, to: fmt(staff.role, staff.district) } })
  return { ok: true, data: next }
}
