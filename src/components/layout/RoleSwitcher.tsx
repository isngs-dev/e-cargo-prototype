import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronDown } from 'lucide-react'
import { useStore } from '@/app/store'
import { personas } from '@/data/personas'
import { roleLabels } from '@/lib/permissions'
import { cn } from '@/lib/cn'

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')

/** Demonstration-only persona switcher. Not authentication. */
export function RoleSwitcher() {
  const { persona, switchPersona } = useStore()
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-md border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 text-left shadow-xs hover:bg-slate-50"
      >
        <span className="flex size-8 items-center justify-center rounded bg-brand-600 text-xs font-semibold text-white">{initials(persona.name)}</span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-medium text-slate-900">{persona.name}</span>
          <span className="block truncate text-xs text-slate-500">{roleLabels[persona.role]}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-700">Switch demo role</p>
            <p className="text-[11px] text-slate-500">Demonstration mechanism only — not a login.</p>
          </div>
          <ul role="listbox" aria-label="Demo personas" className="max-h-[70vh] overflow-y-auto py-1">
            {personas.map((p) => {
              const active = p.id === persona.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      switchPersona(p.id)
                      setOpen(false)
                      navigate('/dashboard')
                    }}
                    className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50', active && 'bg-brand-50')}
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-slate-200 text-[11px] font-semibold text-slate-700">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{roleLabels[p.role]}</span>
                      <span className="block truncate text-xs text-slate-500">{p.name} · {p.title}</span>
                    </span>
                    {active && <Check className="mt-1 size-4 text-brand-600" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
