import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TrainFront } from 'lucide-react'
import { buttonClass } from '@/components/ui/primitives'

/** Shell for the public pages (landing, AWB verification) — no sidebar, no role switcher. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
        <strong className="font-semibold">Prototype</strong> — a demonstration of the NRC e-Cargo platform. Data is simulated and stored only in your browser.
      </div>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-brand-700 text-white"><TrainFront className="size-5" aria-hidden /></span>
            <span className="leading-tight"><span className="block text-sm font-semibold text-slate-900">NRC e-Cargo</span><span className="block text-[11px] text-slate-500">Cargo Operations Platform</span></span>
          </Link>
          <nav aria-label="Public" className="flex items-center gap-1 text-sm">
            <a href="/#services" className="hidden rounded px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Services</a>
            <a href="/#availability" className="hidden rounded px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Train availability</a>
            <a href="/#faq" className="hidden rounded px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">FAQ</a>
            <Link to="/verify" className="hidden rounded px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Verify an AWB</Link>
            <Link to="/dashboard" className={buttonClass('primary', 'sm', 'ml-2')}>Open the platform</Link>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        NRC e-Cargo prototype · All names, amounts and documents are fictional demonstration data · No real payments, emails or integrations.
      </footer>
    </div>
  )
}
