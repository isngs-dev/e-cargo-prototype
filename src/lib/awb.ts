import type { Booking } from '@/types/domain'

/**
 * Demo AWB numbering. Format is a PROPOSAL (open item #10): NRC-AWB-YY-NNNNNN-C,
 * where C is a mod-10 (Luhn) check digit over the sequence. Not a mandated NRC series.
 */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

export function formatAwbNumber(year: number, sequence: number): string {
  const seq = String(sequence).padStart(6, '0')
  return `NRC-AWB-${String(year).slice(-2)}-${seq}-${luhnCheckDigit(seq)}`
}

export function isValidAwbNumber(awb: string): boolean {
  const m = /^NRC-AWB-\d{2}-(\d{6})-(\d)$/.exec(awb)
  return !!m && luhnCheckDigit(m[1]!) === Number(m[2])
}

/** Demo verification reference encoded in the QR preview. Not a signed production URL. */
export function demoVerificationRef(awb: string, version = 1): string {
  return `DEMO-VERIFY://nrc-ecargo-prototype/awb/${awb}?v=${version}`
}

export type AwbVerification =
  | { status: 'valid'; booking: Booking; version: number }
  | { status: 'superseded'; booking: Booking; version: number; currentVersion: number }
  | { status: 'not_found' }
  | { status: 'invalid_number' }

/** Gate check: a forged number fails the check digit; an old version is reported as superseded. Demo data only. */
export function verifyAwb(bookings: Booking[], number: string, version?: number): AwbVerification {
  const n = number.trim().toUpperCase()
  if (!isValidAwbNumber(n)) return { status: 'invalid_number' }
  const booking = bookings.find((b) => b.awb?.number === n)
  if (!booking || !booking.awb) return { status: 'not_found' }
  const current = booking.awb.version
  const v = version ?? current
  const known = v === current || (booking.awbHistory ?? []).some((h) => h.version === v)
  if (!known) return { status: 'not_found' }
  return v === current ? { status: 'valid', booking, version: v } : { status: 'superseded', booking, version: v, currentVersion: current }
}
