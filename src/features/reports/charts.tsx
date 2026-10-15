import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import type { Delta } from '@/lib/reports'
import type { Tone } from '@/lib/status'

/** Dependency-free SVG / HTML charts. Colours are a small, consistent palette shared by every chart on the page. */

export const toneColor: Record<Tone, string> = {
  success: '#059669', info: '#0284c7', warning: '#d97706', danger: '#dc2626', accent: '#7c3aed', neutral: '#94a3b8',
}
export const SERIES = { awbs: '#0b6e4f', registrations: '#7c3aed', bookings: '#0284c7', revenue: '#0b6e4f', refunds: '#dc2626' } as const

export function compactNaira(kobo: number): string {
  const n = kobo / 100
  const abs = Math.abs(n)
  const fmt = (v: number, unit: string) => `₦${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`
  if (abs >= 1e9) return fmt(n / 1e9, 'B')
  if (abs >= 1e6) return fmt(n / 1e6, 'M')
  if (abs >= 1e3) return fmt(n / 1e3, 'K')
  return `₦${Math.round(n)}`
}

function useWidth<T extends HTMLElement>(fallback = 560) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceScale(max: number, integer: boolean): { top: number; step: number } {
  if (max <= 0) return { top: integer ? 4 : 1, step: integer ? 1 : 0.25 }
  const raw = max / 4
  const exp = 10 ** Math.floor(Math.log10(raw))
  const f = raw / exp
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
  if (integer) step = Math.max(1, Math.ceil(step))
  return { top: Math.ceil(max / step) * step, step }
}

// ---------------------------------------------------------------- line chart

export interface LineSeries { key: string; label: string; color: string; values: number[] }

export function LineChart({ labels, series, format, axisFormat, integer = false, height = 240, ariaLabel }: {
  labels: string[]
  series: LineSeries[]
  /** Tooltip value formatter. */
  format: (n: number) => string
  axisFormat?: (n: number) => string
  integer?: boolean
  height?: number
  ariaLabel: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { top: 12, right: 14, bottom: 28, left: axisFormat ? 54 : 34 }
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom
  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const { top, step } = niceScale(max, integer)
  const x = (i: number) => m.left + (labels.length <= 1 ? innerW / 2 : (i * innerW) / (labels.length - 1))
  const y = (v: number) => m.top + innerH - (v / top) * innerH
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(v)
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 72))))
  const fmtAxis = axisFormat ?? ((n: number) => String(Math.round(n * 100) / 100))

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - box.left
    const i = labels.length <= 1 ? 0 : Math.round((rel / box.width) * (labels.length - 1))
    setHover(Math.min(labels.length - 1, Math.max(0, i)))
  }
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) - 80, 0), width - 170)

  return (
    <div ref={ref} className="relative w-full">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />{s.label}</span>
        ))}
      </div>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block max-w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={m.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#64748b">{fmtAxis(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 ? <text key={`${l}-${i}`} x={x(i)} y={height - 8} textAnchor={x(i) + 32 > width ? 'end' : 'middle'} fontSize={11} fill="#64748b">{l}</text> : null))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + innerH} stroke="#94a3b8" strokeDasharray="3 3" />}
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {labels.length <= 40 && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 2.5} fill="#fff" stroke={s.color} strokeWidth={2} />)}
          </g>
        ))}
        <rect x={m.left} y={m.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-8 z-10 w-40 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-md" style={{ left: tipLeft }}>
          <p className="mb-1 font-semibold text-slate-900">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-2 text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: s.color }} aria-hidden />{s.label}</span>
              <span className="font-medium tabular-nums text-slate-900">{format(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- donut

export interface DonutSlice { key: string; label: string; value: number; color: string }

export function Donut({ slices, centreLabel, ariaLabel }: { slices: DonutSlice[]; centreLabel: string; ariaLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const R = 52
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={136} height={136} viewBox="0 0 136 136" role="img" aria-label={ariaLabel} className="shrink-0">
        <circle cx={68} cy={68} r={R} fill="none" stroke="#f1f5f9" strokeWidth={18} />
        {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * C
          const el = <circle key={s.key} cx={68} cy={68} r={R} fill="none" stroke={s.color} strokeWidth={18} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 68 68)" />
          offset += len
          return el
        })}
        <text x={68} y={64} textAnchor="middle" fontSize={22} fontWeight={600} fill="#0f172a">{total}</text>
        <text x={68} y={82} textAnchor="middle" fontSize={11} fill="#64748b">{centreLabel}</text>
      </svg>
      <ul className="w-full min-w-0 space-y-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-slate-600"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden /><span className="truncate">{s.label}</span></span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">{s.value} <span className="font-normal text-slate-400">({total ? Math.round((s.value / total) * 100) : 0}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- comparison bars (grouped bar alternative that stays readable on phones)

export interface CompareColumn { key: string; label: string; color: string; format: (n: number) => string }
export interface CompareRow { key: string; label: string; values: Record<string, number> }

export function ComparisonBars({ rows, columns }: { rows: CompareRow[]; columns: CompareColumn[] }) {
  const max = Object.fromEntries(columns.map((c) => [c.key, Math.max(0, ...rows.map((r) => r.values[c.key] ?? 0))]))
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.key} className="px-5 py-3">
          <p className="mb-2 text-sm font-medium text-slate-900">{r.label}</p>
          <div className="space-y-1.5">
            {columns.map((c) => {
              const v = r.values[c.key] ?? 0
              const pct = max[c.key] ? (v / max[c.key]!) * 100 : 0
              return (
                <div key={c.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-500">{c.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${Math.max(v > 0 ? 3 : 0, pct)}%`, background: c.color }} /></span>
                  <span className="min-w-14 text-right font-medium tabular-nums text-slate-900">{c.format(v)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- stacked bar

export function SplitBar({ label, a, b, aLabel, bLabel, format = (n) => String(n) }: { label: string; a: number; b: number; aLabel: string; bLabel: string; format?: (n: number) => string }) {
  const total = a + b
  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between text-xs"><span className="font-medium text-slate-700">{label}</span><span className="text-slate-400">{total ? '' : 'No data'}</span></p>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${aLabel} ${format(a)}, ${bLabel} ${format(b)}`}>
        {total > 0 && <span style={{ width: `${(a / total) * 100}%`, background: '#7c3aed' }} />}
        {total > 0 && <span style={{ width: `${(b / total) * 100}%`, background: '#94a3b8' }} />}
      </div>
      <p className="mt-1 flex justify-between text-xs text-slate-600">
        <span><span className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: '#7c3aed' }} aria-hidden />{aLabel} <strong className="tabular-nums text-slate-900">{format(a)}</strong></span>
        <span><span className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: '#94a3b8' }} aria-hidden />{bLabel} <strong className="tabular-nums text-slate-900">{format(b)}</strong></span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- KPI card with honest comparison

const kpiAccent: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600', info: 'bg-sky-50 text-sky-700', warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700', danger: 'bg-red-50 text-red-700', accent: 'bg-violet-50 text-violet-700',
}

export function DeltaChip({ delta, comparable, goodWhen = 'up', money = false }: { delta: Delta; comparable: boolean; goodWhen?: 'up' | 'down'; money?: boolean }) {
  if (!comparable || delta.previous === null) return <span className="text-slate-400">No prior-period comparison for this range</span>
  const prevText = money ? compactNaira(delta.previous) : String(delta.previous)
  if (delta.pct === null) return <span className="text-slate-500">{delta.previous === 0 && delta.current === 0 ? 'No activity in either period' : `Previous period: ${prevText} (no % change available)`}</span>
  const up = delta.pct > 0
  const flat = delta.pct === 0
  const good = flat ? null : up === (goodWhen === 'up')
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={cn('inline-flex items-center gap-0.5 font-medium', good === null ? 'text-slate-600' : good ? 'text-emerald-700' : 'text-red-700')}>
        <Icon className="size-3.5" aria-hidden />{Math.abs(delta.pct)}%
      </span>
      <span className="text-slate-500">vs previous period ({prevText})</span>
    </span>
  )
}

export function ReportKpi({ label, value, icon: Icon, tone, children, footer }: { label: string; value: ReactNode; icon: LucideIcon; tone: Tone; children?: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        </div>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', kpiAccent[tone])}><Icon className="size-4.5" aria-hidden /></span>
      </div>
      {children && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">{children}</div>}
      {footer && <div className="mt-auto pt-2 text-xs">{footer}</div>}
    </Card>
  )
}
