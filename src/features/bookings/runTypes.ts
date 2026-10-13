import type { AppData } from '@/types/domain'
import type { WorkflowResult } from '@/lib/workflow/result'

/** Runs a workflow function; returns an error message, or null on success (a success notice is shown by the page). */
export type Run = (fn: (d: AppData) => WorkflowResult, success: string) => string | null
