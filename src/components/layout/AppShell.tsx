import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { BookOpen, House, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, TrainFront, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { navForPersona, navLabel } from '@/app/navigation'
import { rememberBase } from '@/app/returnTarget'
import { Flash } from '@/components/ui/blocks'
import { cn } from '@/lib/cn'
import { roleLabels } from '@/lib/permissions'
import { Button, buttonClass } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { UserMenu } from './UserMenu'
import { MailBell } from './MailBell'

/** `collapsed` renders a slim icon-only rail (desktop). The mobile drawer always renders the full sidebar. */
const SIDEBAR_KEY = 'nrc-ecargo-prototype:sidebar-collapsed'

function Sidebar({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const { persona } = useStore()
  const items = navForPersona(persona)
  return (
    <div className="flex h-full flex-col bg-brand-900 text-brand-50">
      <div className={cn('flex h-16 items-center border-b border-white/10', collapsed ? 'justify-center px-0' : 'justify-between gap-2 pl-5 pr-3')}>
        <Link to="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-brand-200" aria-label="NRC e-Cargo — go to dashboard" title="Go to dashboard">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10">
            <TrainFront className="size-4.5" aria-hidden />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">NRC e-Cargo</span>
              <span className="block truncate text-[11px] text-brand-200">Operations Platform</span>
            </span>
          )}
        </Link>
        {!collapsed && onToggle && (
          <button type="button" onClick={onToggle} className="rounded-md p-1.5 text-brand-200 hover:bg-white/10 hover:text-white" aria-label="Collapse navigation" aria-expanded title="Collapse navigation">
            <PanelLeftClose className="size-5" aria-hidden />
          </button>
        )}
      </div>
      {collapsed && onToggle && (
        <button type="button" onClick={onToggle} className="mx-auto mt-3 rounded-md p-2 text-brand-200 hover:bg-white/10 hover:text-white" aria-label="Expand navigation" aria-expanded={false} title="Expand navigation">
          <PanelLeftOpen className="size-5" aria-hidden />
        </button>
      )}
      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')} aria-label="Main">
        {!collapsed && <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">{roleLabels[persona.role]}</p>}
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/bookings'}
                onClick={onNavigate}
                title={collapsed ? navLabel(item, persona.role) : undefined}
                aria-label={collapsed ? navLabel(item, persona.role) : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md py-2 text-sm transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-2.5',
                    isActive ? 'bg-white/12 font-medium text-white' : 'text-brand-100/85 hover:bg-white/6 hover:text-white',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {!collapsed && <span className="flex-1 truncate">{navLabel(item, persona.role)}</span>}
                {!collapsed && !item.built && <span className="rounded bg-white/10 px-1.5 text-[10px] text-brand-100/80">P{item.phase}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {!collapsed && (
        <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-snug text-brand-200/80">
          Demonstration prototype. Data is simulated and stored only in this browser.
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const { resetDemo, signedIn, persona, data } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
  })
  const location = useLocation()

  const toggleSidebar = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0') } catch { /* storage unavailable — the toggle still works for this session */ }
    return next
  })

  useEffect(() => { rememberBase(location.pathname) }, [location.pathname])
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const shellFlash = (location.state as { shellFlash?: string } | null)?.shellFlash ?? null

  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard', bookings: 'Bookings', registrations: 'Registrations', customers: 'Customers', company: 'Company profile', dispatch: 'Dispatch queue',
      awbs: 'AWBs', refunds: 'Refunds', payments: 'Payment exceptions', staff: 'Staff accounts', 'master-data': 'Routes & rates', audit: 'Audit log',
      capacity: 'Train capacity', reports: 'Reports & analytics', register: 'Register', 'my-registration': 'My registration', 'demo-guide': 'Demo guide',
    }
    const seg = location.pathname.split('/')[1] ?? ''
    document.title = `${titles[seg] ?? 'NRC e-Cargo'} · NRC e-Cargo Prototype`
  }, [location.pathname])

  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // A newly approved company must replace its temporary password before using the platform.
  if (data.customers.find((c) => c.id === persona.customerId)?.firstLogin) return <Navigate to="/change-password" replace />

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block print:hidden', collapsed ? 'w-16' : 'w-64')}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
          <button type="button" className="absolute left-66 top-4 rounded-md bg-white p-1.5 text-slate-700" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200 print:pl-0', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <header className="print:hidden sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <Link to="/" className={buttonClass('ghost', 'sm')} title="Back to the home page"><House className="size-3.5" /> <span className="hidden sm:inline">Home</span></Link>
          <Link to="/demo-guide" className={buttonClass('ghost', 'sm')} title="Stakeholder walk-through"><BookOpen className="size-3.5" /> <span className="hidden sm:inline">Demo guide</span></Link>
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} title="Restore seeded demo data">
            <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Reset demo</span>
          </Button>
          <MailBell />
          <UserMenu />
        </header>
        <main id="main" tabIndex={-1} key={location.pathname} className={cn('mx-auto px-4 py-6 outline-none transition-[max-width] duration-200 sm:px-6 lg:py-8', collapsed ? 'max-w-none lg:px-8' : 'max-w-7xl')}>
          {shellFlash && dismissedKey !== location.key && <Flash message={shellFlash} onDismiss={() => setDismissedKey(location.key)} />}
          <Outlet />
        </main>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demonstration data?"
        description="All changes made in this browser will be discarded and the seeded demo records restored."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { resetDemo(); setConfirmReset(false) }}>Reset data</Button>
          </>
        }
      />
    </div>
  )
}
