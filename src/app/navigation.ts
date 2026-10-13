import type { LucideIcon } from 'lucide-react'
import {
  Building,
  ClipboardCheck,
  FilePen,
  Database,
  LayoutDashboard,
  Package,
  Plus,
  QrCode,
  Receipt,
  ScrollText,
  Truck,
  Undo2,
  UserCog,
  Users,
} from 'lucide-react'
import type { Persona, Role } from '@/types/domain'
import { canAccessPersona, type Area } from '@/lib/permissions'

export interface NavItem {
  area: Area
  path: string
  label: string | Partial<Record<Role, string>> & { default: string }
  icon: LucideIcon
  /** Implementation phase in which the screen is (or will be) built. */
  phase: number
  built: boolean
}

export const navItems: NavItem[] = [
  { area: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, phase: 2, built: true },
  { area: 'my_registration', path: '/my-registration', label: 'My Registration', icon: FilePen, phase: 3, built: true },
  { area: 'new_booking', path: '/bookings/new', label: 'New Booking', icon: Plus, phase: 4, built: false },
  {
    area: 'bookings', path: '/bookings', icon: Package, phase: 2, built: true,
    label: { default: 'Bookings', cargo_facilitator: 'My Bookings', head_of_cargo: 'Booking Reviews', head_port_operations: 'All Bookings' },
  },
  { area: 'registrations', path: '/registrations', label: { default: 'Registrations', district_supervisor: 'Registration Queue' }, icon: ClipboardCheck, phase: 2, built: true },
  { area: 'dispatch', path: '/dispatch', label: 'Dispatch Queue', icon: Truck, phase: 6, built: false },
  { area: 'awbs', path: '/awbs', label: 'AWBs', icon: QrCode, phase: 6, built: false },
  { area: 'company_profile', path: '/company', label: 'Company Profile', icon: Building, phase: 2, built: true },
  { area: 'customers', path: '/customers', label: 'Customers', icon: Users, phase: 2, built: true },
  { area: 'refunds', path: '/refunds', label: 'Refunds', icon: Undo2, phase: 6, built: false },
  { area: 'payments', path: '/payments', label: 'Payment Exceptions', icon: Receipt, phase: 7, built: false },
  { area: 'staff', path: '/staff', label: 'Staff Accounts', icon: UserCog, phase: 7, built: false },
  { area: 'master_data', path: '/master-data', label: 'Routes & Rates', icon: Database, phase: 2, built: true },
  { area: 'audit', path: '/audit', label: 'Audit Log', icon: ScrollText, phase: 2, built: true },
]

export const planDescriptions: Partial<Record<Area, { title: string; scope: string[] }>> = {
  new_booking: {
    title: 'New Booking',
    scope: [
      'Booking date, cargo type, route from Route & Freight Rate Master',
      'Multiple container lines (20ft / 40ft / Reefer) or wagons',
      'Weight, commodity, hazardous flag with compliance document upload',
      'Mandatory documents and Fair Cargo Policy declaration',
      'Live indicative price breakdown; blocked when no rate exists',
    ],
  },
  dispatch: {
    title: 'Dispatch Queue',
    scope: [
      'Only bookings whose payment or credit condition is satisfied',
      'Physical verification checklist',
      'Wagon, train, departure date/time, loading yard',
      'Fail → report to Director with mandatory reason (refund flow if paid)',
      'Approve dispatch → idempotent AWB generation',
    ],
  },
  awbs: { title: 'Air Waybills (AWB)', scope: ['AWB register and preview', 'Demo QR verification reference', 'Version / superseded handling'] },
  refunds: {
    title: 'Refunds',
    scope: [
      'Director triggers refund link after physical-verification failure',
      'Facilitator submits simulated refund request',
      'Super Admin processes (simulated) — Requested → Under Review → Approved → Processed',
    ],
  },
  payments: { title: 'Payment Exceptions', scope: ['Unmatched / duplicate simulated payments', 'Simulated reconciliation actions'] },
  staff: { title: 'Staff Accounts', scope: ['Create NRC staff accounts (simulated credentials)', 'Reset, suspend, revoke, reassign roles', 'All actions audit-logged'] },
}

export function navLabel(item: NavItem, role: Role): string {
  return typeof item.label === 'string' ? item.label : (item.label[role] ?? item.label.default)
}

export function navForPersona(persona: Persona): NavItem[] {
  return navItems.filter((i) => canAccessPersona(persona, i.area))
}
