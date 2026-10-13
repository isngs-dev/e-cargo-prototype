import type { AppData, District, Role } from '@/types/domain'

export interface Actor {
  name: string
  role: Role
  /** Demo applicant only: the registration application this actor owns. */
  applicantAppId?: string
  /** Activated facilitator only: the customer company this actor represents. */
  customerId?: string
  /** District Supervisor only: the district whose applications this actor may handle. */
  district?: District
}

export type WorkflowResult<T extends object = object> = ({ ok: true; data: AppData } & T) | { ok: false; error: string }

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
