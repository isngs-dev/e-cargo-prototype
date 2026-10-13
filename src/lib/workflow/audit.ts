import type { AppData, AuditEntry } from '@/types/domain'

export function appendAudit(data: AppData, e: Omit<AuditEntry, 'id'>) {
  data.audit.push({ id: `au-${String(data.audit.length + 1).padStart(4, '0')}`, ...e })
}

export const SYSTEM_ACTOR = { actorName: 'System (simulated)', actorRole: 'system' } as const
