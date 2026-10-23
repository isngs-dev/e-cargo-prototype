import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, House, LogOut, Mail, Send } from 'lucide-react'
import { useStore } from '@/app/store'
import { roleLabels } from '@/lib/permissions'

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')

/** Signed-in user, with Home and Sign out. */
export function UserMenu() {
  const { persona, signOut } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-3 rounded-md border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 text-left shadow-xs hover:bg-slate-50">
        <span className="flex size-8 items-center justify-center rounded bg-brand-600 text-xs font-semibold text-white">{initials(persona.name)}</span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-medium text-slate-900">{persona.name}</span>
          <span className="block truncate text-xs text-slate-500">{roleLabels[persona.role]}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{persona.name}</p>
            <p className="text-xs text-slate-500">{persona.title}</p>
          </div>
          <Link to="/" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><House className="size-4" aria-hidden /> Back to home page</Link>
          <Link to="/mail" target="_blank" rel="noopener" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Mail className="size-4" aria-hidden /> Open mail outbox</Link>
          <Link to="/live-setup" target="_blank" rel="noopener" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Send className="size-4" aria-hidden /> Live delivery setup</Link>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); navigate('/login') }} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
