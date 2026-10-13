import { describe, expect, it } from 'vitest'
import { calculatePrice, PricingError, tryCalculatePrice } from './pricing'
import { allowedPaymentTerms, discountReductionNeedsReason, isCreditBlocked, validateFinalDiscount, validatePaymentTerms } from './eligibility'
import { formatAwbNumber, isValidAwbNumber } from './awb'
import { isReadyForDispatch } from './status'
import { runRegistrationChecks } from './registration'
import { naira } from './money'
import * as seed from '@/data/seed'
import type { CustomerEligibility, FreightRate } from '@/types/domain'

const rates: FreightRate[] = [
  { id: 'r1', routeId: 'rt', cargoType: 'Containerized', containerType: '20ft', ratePerUnit: naira(85_000), effectiveFrom: '2025-07-01' },
  { id: 'r2', routeId: 'rt', cargoType: 'Containerized', containerType: '20ft', ratePerUnit: naira(90_000), effectiveFrom: '2026-01-01' },
]
const base = { routeId: 'rt', cargoType: 'Containerized' as const, containers: [{ containerType: '20ft' as const, quantity: 2 }], bookingDate: '2026-10-20' }

const priority: CustomerEligibility = { isPriority: true, eligibleDiscountBp: 1000, eligibleCreditMonths: 2, creditThreshold: naira(5_000_000), category: 'Strategic' }
const nonPriority: CustomerEligibility = { isPriority: false, eligibleDiscountBp: 0, eligibleCreditMonths: 0, creditThreshold: 0, category: 'SME' }

describe('pricing', () => {
  it('matches the confirmed priority example (10% discount, net basis)', () => {
    const p = calculatePrice({ ...base, discountBp: 1000 }, rates, seed.config.tax)
    expect(p.baseFreight).toBe(naira(180_000))
    expect(p.discount).toBe(naira(18_000))
    expect(p.netFreight).toBe(naira(162_000))
    expect(p.vat).toBe(naira(12_150))
    expect(p.stampDuty).toBe(naira(1_215))
    expect(p.insurance).toBe(naira(2_430))
    expect(p.totalPayable).toBe(naira(177_795))
  })

  it('matches the confirmed non-priority example (no discount)', () => {
    const p = calculatePrice({ ...base, discountBp: 0 }, rates, seed.config.tax)
    expect(p.discount).toBe(0)
    expect(p.totalPayable).toBe(naira(197_550))
  })

  it('uses the effective-dated rate in force on the booking date', () => {
    expect(calculatePrice({ ...base, bookingDate: '2025-12-31', discountBp: 0 }, rates, seed.config.tax).lines[0]!.rateId).toBe('r1')
    expect(calculatePrice({ ...base, discountBp: 0 }, rates, seed.config.tax).lines[0]!.rateId).toBe('r2')
  })

  it('never returns zero for a missing rate', () => {
    expect(() => calculatePrice({ ...base, containers: [{ containerType: '40ft', quantity: 1 }], discountBp: 0 }, rates, seed.config.tax)).toThrow(PricingError)
    const r = tryCalculatePrice({ routeId: 'rt-mny', cargoType: 'Non-Containerized', containers: [{ containerType: 'Wagon', quantity: 2 }], bookingDate: '2026-10-20', discountBp: 0 }, seed.freightRates, seed.config.tax)
    expect(r.ok).toBe(false)
  })

  it('rejects empty and non-integer quantities', () => {
    expect(() => calculatePrice({ ...base, containers: [], discountBp: 0 }, rates, seed.config.tax)).toThrow(/At least one/)
    expect(() => calculatePrice({ ...base, containers: [{ containerType: '20ft', quantity: 1.5 }], discountBp: 0 }, rates, seed.config.tax)).toThrow(/whole number/)
  })

  it('supports gross tax basis when configured', () => {
    const p = calculatePrice({ ...base, discountBp: 1000 }, rates, { ...seed.config.tax, basis: 'gross' })
    expect(p.vat).toBe(naira(13_500))
  })
})

describe('eligibility', () => {
  it('caps the Director discount at the eligible maximum', () => {
    expect(validateFinalDiscount(priority, 1000).ok).toBe(true)
    expect(validateFinalDiscount(priority, 500).ok).toBe(true)
    expect(validateFinalDiscount(priority, 1200).ok).toBe(false)
  })
  it('blocks any discount for non-priority customers', () => {
    expect(validateFinalDiscount(nonPriority, 0).ok).toBe(true)
    expect(validateFinalDiscount(nonPriority, 100).ok).toBe(false)
  })
  it('requires a reason when granting below the maximum', () => {
    expect(discountReductionNeedsReason(priority, 800)).toBe(true)
    expect(discountReductionNeedsReason(priority, 1000)).toBe(false)
    expect(discountReductionNeedsReason(nonPriority, 0)).toBe(false)
  })
  it('limits payment terms and credit period', () => {
    expect(allowedPaymentTerms(nonPriority)).toEqual(['pay_now'])
    expect(validatePaymentTerms(nonPriority, 'pay_after_credit', 1).ok).toBe(false)
    expect(validatePaymentTerms(priority, 'pay_after_credit', 2).ok).toBe(true)
    expect(validatePaymentTerms(priority, 'pay_after_credit', 3).ok).toBe(false)
  })
  it('blocks bookings once outstanding credit exceeds the threshold', () => {
    expect(isCreditBlocked(priority, naira(5_000_000))).toBe(false)
    expect(isCreditBlocked(priority, naira(5_000_001))).toBe(true)
  })
})

describe('dispatch gate and AWB', () => {
  it('does not release unpaid pay-now bookings to dispatch', () => {
    const byId = (id: string) => seed.bookings.find((b) => b.id === id)!
    expect(isReadyForDispatch(byId('bk-0401'))).toBe(false) // awaiting payment
    expect(isReadyForDispatch(byId('bk-0398'))).toBe(true) // paid
    expect(isReadyForDispatch(byId('bk-0405'))).toBe(true) // credit approved
    expect(isReadyForDispatch(byId('bk-0390'))).toBe(false) // already has AWB
  })
  it('formats AWB numbers with a valid check digit', () => {
    const n = formatAwbNumber(2026, 101)
    expect(n).toMatch(/^NRC-AWB-26-000101-\d$/)
    expect(isValidAwbNumber(n)).toBe(true)
    expect(isValidAwbNumber(n.slice(0, -1) + ((Number(n.slice(-1)) + 1) % 10))).toBe(false)
  })
})

describe('seed integrity', () => {
  it('prices every seeded booking with a non-zero total', () => {
    for (const b of seed.bookings) expect(b.indicativePrice.totalPayable).toBeGreaterThan(0)
  })
  it('flags duplicate CAC, blacklist and missing documents on seeded applications', () => {
    const check = (id: string) => runRegistrationChecks(seed.applications.find((a) => a.id === id)!, seed.customers, seed.applications, false)
    expect(check('reg-ogun').every((c) => c.passed)).toBe(true)
    expect(check('reg-ekobulk').find((c) => c.key === 'incomplete_docs')!.passed).toBe(false)
    expect(check('reg-swiftdelta').find((c) => c.key === 'blacklisted')!.passed).toBe(false)
  })
})
