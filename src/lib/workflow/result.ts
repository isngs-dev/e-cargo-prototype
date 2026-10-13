import type { AppData, Role } from '@/types/domain'

export interface Actor {
  name: string
  role: Role
  /** Demo applicant only: the registration application this actor owns. */
  applicantAppId?: string
}

export type WorkflowResult<T extends object = object> = ({ ok: true; data: AppData } & T) | { ok: false; error: string }

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
