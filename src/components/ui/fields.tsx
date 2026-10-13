import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Field({ label, error, hint, required, children, className }: { label: string; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-800">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
        <div className="mt-1 font-normal">{children}</div>
      </label>
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn('min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20', className)}
      {...props}
    />
  )
}

export function CheckboxGroup<T extends string>({ legend, options, value, onChange, error, required }: { legend: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void; error?: string; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-800">{legend} {required && <span className="text-red-600" aria-hidden>*</span>}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <label key={o} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')}>
              <input type="checkbox" className="accent-brand-600" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
              {o}
            </label>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </fieldset>
  )
}
