import type { Role } from '@/types/domain'

/**
 * "Back to where you were": officers who finish a decision on a booking / registration / refund page return to the list
 * or dashboard they opened it from. The shell remembers the last base page visited; detail pages read it after a decision.
 */
const BASE = /^\/(dashboard|bookings|registrations|dispatch|refunds|payments|customers|awbs|capacity|reports)$/
const KEY = 'nrc-ecargo-prototype:return-to'

export function rememberBase(pathname: string): void {
  if (!BASE.test(pathname)) return
  try { sessionStorage.setItem(KEY, pathname) } catch { /* private mode: fall back to the role default */ }
}

/** Officers who return after a decision. Super Admin, Managing Director and customers stay on the page. */
const OFFICERS: Role[] = ['district_supervisor', 'head_of_cargo', 'director_operations', 'head_port_operations']
export const returnsAfterDecision = (role: Role): boolean => OFFICERS.includes(role)

const DEFAULT_BASE: Partial<Record<Role, string>> = {
  district_supervisor: '/registrations', head_of_cargo: '/bookings', director_operations: '/dashboard', head_port_operations: '/dispatch',
}

export function returnTarget(role: Role): string {
  try {
    const last = sessionStorage.getItem(KEY)
    if (last && BASE.test(last)) return last
  } catch { /* ignore */ }
  return DEFAULT_BASE[role] ?? '/dashboard'
}
