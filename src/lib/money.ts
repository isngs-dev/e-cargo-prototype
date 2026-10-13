import type { BasisPoints, Kobo } from '@/types/domain'

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const naira = (n: number): Kobo => Math.round(n * 100)

export function formatKobo(amount: Kobo): string {
  return ngn.format(amount / 100)
}

/** Apply a basis-point rate to a kobo amount, rounding half away from zero to the nearest kobo. */
export function applyBp(amount: Kobo, bp: BasisPoints): Kobo {
  return Math.round((amount * bp) / 10_000)
}

export function formatBp(bp: BasisPoints): string {
  const pct = bp / 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`
}
