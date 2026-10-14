import type { Persona, Role } from '@/types/domain'

export const roleLabels: Record<Role, string> = {
  cargo_facilitator: 'Cargo Facilitator',
  district_supervisor: 'District Supervisor',
  head_of_cargo: 'Head of Cargo',
  director_operations: 'Director of Operations',
  head_port_operations: 'Head of Port Operations',
  super_admin: 'Super Admin',
}

/** Application areas. Each route declares which area it belongs to. */
export type Area =
  | 'dashboard'
  | 'bookings'
  | 'new_booking'
  | 'registrations'
  | 'company_profile'
  | 'customers'
  | 'dispatch'
  | 'awbs'
  | 'refunds'
  | 'payments'
  | 'staff'
  | 'master_data'
  | 'audit'
  | 'my_registration'

/** Derived from the role access matrix (baseline doc §10). */
const access: Record<Role, Area[]> = {
  cargo_facilitator: ['dashboard', 'bookings', 'new_booking', 'company_profile', 'awbs', 'refunds'],
  district_supervisor: ['dashboard', 'registrations'],
  head_of_cargo: ['dashboard', 'bookings', 'awbs'],
  director_operations: ['dashboard', 'registrations', 'bookings', 'customers', 'awbs', 'refunds', 'master_data', 'audit'],
  head_port_operations: ['dashboard', 'dispatch', 'bookings', 'awbs'],
  super_admin: ['dashboard', 'staff', 'customers', 'master_data', 'payments', 'refunds', 'registrations', 'bookings', 'awbs', 'audit'],
}

export function canAccess(role: Role, area: Area): boolean {
  return access[role].includes(area)
}

/** The demo applicant is a facilitator without an activated company: dashboard + own registration only. */
export function canAccessPersona(persona: Persona, area: Area): boolean {
  if (persona.isApplicant) return area === 'dashboard' || area === 'my_registration'
  if (area === 'my_registration') return false
  return canAccess(persona.role, area)
}

/** Super Admin has platform authority only — never business approval authority (baseline §1.1, §2.3). */
export function hasBusinessAuthority(role: Role): boolean {
  return role === 'director_operations'
}

/** Roles that can see every record (others see own records or own queue). */
export function hasFullVisibility(role: Role): boolean {
  return role === 'director_operations' || role === 'super_admin'
}
