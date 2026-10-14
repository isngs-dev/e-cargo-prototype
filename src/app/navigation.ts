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
  { area: 'new_booking', path: '/bookings/new', label: 'New Booking', icon: Plus, phase: 4, built: true },
  {
    area: 'bookings', path: '/bookings', icon: Package, phase: 2, built: true,
    label: { default: 'Bookings', cargo_facilitator: 'My Bookings', head_of_cargo: 'Booking Reviews', head_port_operations: 'All Bookings' },
  },
  { area: 'registrations', path: '/registrations', label: { default: 'Registrations', district_supervisor: 'Registration Queue' }, icon: ClipboardCheck, phase: 2, built: true },
  { area: 'dispatch', path: '/dispatch', label: 'Dispatch Queue', icon: Truck, phase: 6, built: true },
  { area: 'awbs', path: '/awbs', label: 'AWBs', icon: QrCode, phase: 6, built: true },
  { area: 'company_profile', path: '/company', label: 'Company Profile', icon: Building, phase: 2, built: true },
  { area: 'customers', path: '/customers', label: 'Customers', icon: Users, phase: 2, built: true },
  { area: 'refunds', path: '/refunds', label: 'Refunds', icon: Undo2, phase: 6, built: true },
  { area: 'payments', path: '/payments', label: 'Payment Exceptions', icon: Receipt, phase: 7, built: true },
  { area: 'staff', path: '/staff', label: 'Staff Accounts', icon: UserCog, phase: 7, built: true },
  { area: 'master_data', path: '/master-data', label: 'Routes & Rates', icon: Database, phase: 2, built: true },
  { area: 'audit', path: '/audit', label: 'Audit Log', icon: ScrollText, phase: 2, built: true },
]

export function navLabel(item: NavItem, role: Role): string {
  return typeof item.label === 'string' ? item.label : (item.label[role] ?? item.label.default)
}

export function navForPersona(persona: Persona): NavItem[] {
  return navItems.filter((i) => canAccessPersona(persona, i.area))
}
