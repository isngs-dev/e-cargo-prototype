import type { Refund, RefundStatus, Role } from '@/types/domain'

/** What the viewer's role has to do next on a refund (null when nothing). */
export function refundActionHint(role: Role, status: RefundStatus): string | null {
  if (role === 'director_operations' && status === 'awaiting_director') return 'Your action: trigger the refund link'
  if (role === 'cargo_facilitator' && status === 'link_sent') return 'Your action: submit a refund request'
  if (role === 'super_admin') {
    if (status === 'requested') return 'Your action: start review'
    if (status === 'under_review') return 'Your action: approve'
    if (status === 'approved') return 'Your action: process the refund'
  }
  return null
}

export const refundTone = (s: Refund['status']) => (s === 'processed' ? 'success' : s === 'awaiting_director' ? 'warning' : 'info') as 'success' | 'warning' | 'info'
