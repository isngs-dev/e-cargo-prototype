import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Menu, RotateCcw, TrainFront, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { navForPersona, navLabel } from '@/app/navigation'
import { cn } from '@/lib/cn'
import { roleLabels } from '@/lib/permissions'
import { Button } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { RoleSwitcher } from './RoleSwitcher'

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { persona } = useStore()
  const items = navForPersona(persona)
  return (
    <div className="flex h-full flex-col bg-brand-900 text-brand-50">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex size-8 items-center justify-center rounded-md bg-white/10">
          <TrainFront className="size-4.5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">NRC e-Cargo</p>
          <p className="text-[11px] text-brand-200">Operations Platform</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">{roleLabels[persona.role]}</p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/bookings'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                    isActive ? 'bg-white/12 font-medium text-white' : 'text-brand-100/85 hover:bg-white/6 hover:text-white',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 truncate">{navLabel(item, persona.role)}</span>
                {!item.built && <span className="rounded bg-white/10 px-1.5 text-[10px] text-brand-100/80">P{item.phase}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-snug text-brand-200/80">
        Demonstration prototype. Data is simulated and stored only in this browser.
      </div>
    </div>
  )
}

export function AppShell() {
  const { resetDemo } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
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

      <div className="lg:pl-64">
        <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 border-b border-amber-200">
          <strong className="font-semibold">Prototype</strong> — role switcher replaces login; payments, emails and refunds are simulated; no external systems are contacted.
        </div>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} title="Restore seeded demo data">
            <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Reset demo</span>
          </Button>
          <RoleSwitcher />
        </header>
        <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
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
