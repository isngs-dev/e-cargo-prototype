import type { BasisPoints, Booking, CustomerEligibility, Kobo, PaymentTerms } from '@/types/domain'

/**
 * Customer eligibility rules (baseline doc §1.2, §4.3, §6).
 * Entitlement is set at customer level and is never invented at booking level.
 */

/** Discount used for the indicative price at booking creation. */
export function indicativeDiscountBp(e: CustomerEligibility): BasisPoints {
  return e.isPriority ? e.eligibleDiscountBp : 0
}

export function allowedPaymentTerms(e: CustomerEligibility): PaymentTerms[] {
  return e.isPriority && e.eligibleCreditMonths > 0 ? ['pay_now', 'pay_after_credit'] : ['pay_now']
}

export type DecisionCheck = { ok: true } | { ok: false; reason: string }

/** Director's final discount: downward only, capped at eligible maximum; none for non-priority. */
export function validateFinalDiscount(e: CustomerEligibility, requestedBp: BasisPoints): DecisionCheck {
  if (!Number.isInteger(requestedBp) || requestedBp < 0) return { ok: false, reason: 'Discount cannot be negative.' }
  if (!e.isPriority) {
    return requestedBp === 0
      ? { ok: true }
      : { ok: false, reason: 'Non-Priority customers cannot receive a booking-level discount.' }
  }
  if (requestedBp > e.eligibleDiscountBp) {
    return { ok: false, reason: 'Discount exceeds the customer’s eligible maximum.' }
  }
  return { ok: true }
}

/** A discount below the eligible maximum must be recorded with a reason. */
export function discountReductionNeedsReason(e: CustomerEligibility, grantedBp: BasisPoints): boolean {
  return e.isPriority && grantedBp < e.eligibleDiscountBp
}

export function validatePaymentTerms(e: CustomerEligibility, terms: PaymentTerms, creditMonths: number): DecisionCheck {
  if (!allowedPaymentTerms(e).includes(terms)) {
    return { ok: false, reason: 'Pay-after-credit is only available to Priority customers with credit eligibility.' }
  }
  if (terms === 'pay_after_credit') {
    if (!Number.isInteger(creditMonths) || creditMonths < 1) return { ok: false, reason: 'Credit period must be at least 1 month.' }
    if (creditMonths > e.eligibleCreditMonths) return { ok: false, reason: 'Credit period exceeds the eligible maximum.' }
  }
  return { ok: true }
}

/** Unpaid credit balance across a customer's approved credit bookings. Uses frozen prices only. */
export function outstandingCredit(bookings: Booking[], customerId: string): Kobo {
  return bookings
    .filter((b) => b.customerId === customerId && b.payment.status === 'credit_outstanding' && b.approved)
    .reduce((sum, b) => sum + (b.approved?.price.totalPayable ?? 0), 0)
}

/** Further bookings are blocked once outstanding credit exceeds the threshold. */
export function isCreditBlocked(e: CustomerEligibility, outstanding: Kobo): boolean {
  return e.isPriority && e.creditThreshold > 0 && outstanding > e.creditThreshold
}
