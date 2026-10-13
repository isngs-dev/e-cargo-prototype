import type { Booking, BookingStatus, PaymentStatus, RegistrationStatus } from '@/types/domain'

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent'

export const bookingStatusMeta: Record<BookingStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_hoc_review: { label: 'Pending Head of Cargo Review', tone: 'info' },
  sent_back_to_facilitator: { label: 'Sent Back to Facilitator', tone: 'warning' },
  pending_director_review: { label: 'Pending Director Review', tone: 'info' },
  sent_back_to_hoc: { label: 'Sent Back to Head of Cargo', tone: 'warning' },
  awaiting_payment: { label: 'Awaiting Payment', tone: 'warning' },
  credit_approved: { label: 'Credit Approved', tone: 'accent' },
  pending_dispatch: { label: 'Pending Dispatch', tone: 'accent' },
  awb_generated: { label: 'AWB Generated', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  rejected_hoc: { label: 'Rejected — Head of Cargo', tone: 'danger' },
  rejected_director: { label: 'Rejected — Director', tone: 'danger' },
  rejected_physical: { label: 'Rejected — Physical Verification Failed', tone: 'danger' },
  auto_cancelled: { label: 'Auto-Cancelled (Unpaid)', tone: 'danger' },
}

export const registrationStatusMeta: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  pending_district_verification: { label: 'Pending District Verification', tone: 'info' },
  sent_back_to_facilitator: { label: 'Sent Back to Facilitator', tone: 'warning' },
  pending_director_approval: { label: 'Pending Director Approval', tone: 'info' },
  sent_back_to_district: { label: 'Sent Back to District Supervisor', tone: 'warning' },
  activated: { label: 'Activated', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const paymentStatusMeta: Record<PaymentStatus, { label: string; tone: Tone }> = {
  not_due: { label: 'Not yet due', tone: 'neutral' },
  pending: { label: 'Payment pending', tone: 'warning' },
  processing: { label: 'Payment processing (simulated)', tone: 'info' },
  paid: { label: 'Paid (simulated)', tone: 'success' },
  failed: { label: 'Payment failed (simulated)', tone: 'danger' },
  credit_outstanding: { label: 'On credit — outstanding', tone: 'accent' },
  credit_settled: { label: 'Credit settled (simulated)', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const PENDING_APPROVAL: BookingStatus[] = [
  'pending_hoc_review',
  'pending_director_review',
  'sent_back_to_hoc',
  'sent_back_to_facilitator',
]
export const AWB_STATUSES: BookingStatus[] = ['awb_generated', 'completed']
export const REJECTED_STATUSES: BookingStatus[] = ['rejected_hoc', 'rejected_director', 'rejected_physical', 'auto_cancelled']

/**
 * Dispatch gate (baseline §4.4): Head of Port only sees bookings whose payment condition is met.
 * "Payment Link Now" must be paid; "Pay after credit" must be credit-approved.
 */
export function isPaymentConditionMet(b: Booking): boolean {
  if (!b.approved) return false
  if (b.approved.paymentTerms === 'pay_now') return b.payment.status === 'paid'
  return b.payment.status === 'credit_outstanding' || b.payment.status === 'credit_settled'
}

export function isReadyForDispatch(b: Booking): boolean {
  return (b.status === 'pending_dispatch' || b.status === 'credit_approved') && isPaymentConditionMet(b) && !b.awb
}
