import { useState } from 'react'
import { Field } from '@/components/ui/fields'
import { Input, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import type { EligibilityInput } from '@/lib/workflow/registration'
import type { CustomerCategory } from '@/types/domain'

export const categories: CustomerCategory[] = ['Bulk', 'SME', 'Strategic', 'Government']

export const emptyEligibility = (): EligibilityInput => ({ isPriority: false, discountPct: 0, creditMonths: 0, thresholdNaira: 0, category: '' })

/** Director's eligibility inputs. Non-Priority disables discount and credit entirely. */
export function EligibilityForm({ value, onChange, error }: { value: EligibilityInput; onChange: (v: EligibilityInput) => void; error?: string }) {
  const set = (patch: Partial<EligibilityInput>) => onChange({ ...value, ...patch })
  const [rawDiscount, setRawDiscount] = useState(String(value.discountPct))
  const off = !value.isPriority

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-800">Customer status <span className="text-red-600" aria-hidden>*</span></legend>
        <div className="grid grid-cols-2 gap-2">
          {([true, false] as const).map((p) => (
            <label key={String(p)} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', value.isPriority === p ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white hover:bg-slate-50')}>
              <input type="radio" name="priority" className="accent-brand-600" checked={value.isPriority === p} onChange={() => set(p ? { isPriority: true } : { isPriority: false, discountPct: 0, creditMonths: 0, thresholdNaira: 0 })} />
              {p ? 'Priority' : 'Non-Priority'}
            </label>
          ))}
        </div>
        {off && <p className="mt-1 text-xs text-slate-500">Non-Priority customers receive no discount or credit and pay by link immediately.</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eligible discount (%)" hint="Maximum grantable on any future booking">
          <Input
            type="number" min={0} max={100} step={0.5} disabled={off}
            value={off ? 0 : rawDiscount}
            onChange={(e) => { setRawDiscount(e.target.value); set({ discountPct: e.target.value === '' ? NaN : Number(e.target.value) }) }}
          />
        </Field>
        <Field label="Eligible credit period (months)" hint="Maximum grantable on any future booking">
          <Input type="number" min={0} max={12} step={1} disabled={off} value={off ? 0 : Number.isNaN(value.creditMonths) ? '' : value.creditMonths} onChange={(e) => set({ creditMonths: e.target.value === '' ? NaN : Number(e.target.value) })} />
        </Field>
        <Field label="Credit threshold (₦)" hint="Maximum outstanding balance permitted">
          <Input type="number" min={0} step={100000} disabled={off} value={off ? 0 : Number.isNaN(value.thresholdNaira) ? '' : value.thresholdNaira} onChange={(e) => set({ thresholdNaira: e.target.value === '' ? NaN : Number(e.target.value) })} />
        </Field>
        <Field label="Customer category" required>
          <Select value={value.category} onChange={(e) => set({ category: e.target.value as CustomerCategory | '' })}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
