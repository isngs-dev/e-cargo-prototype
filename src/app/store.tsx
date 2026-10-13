import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { AppData, Persona } from '@/types/domain'
import * as seed from '@/data/seed'
import { findPersona } from '@/data/personas'
import { createSeedState, type AppState } from './state'
import type { WorkflowResult } from '@/lib/workflow/result'

/**
 * Prototype state, persisted to this browser's localStorage only.
 * Not shared between users, browsers or devices. Not a production persistence layer.
 */
const STORAGE_KEY = 'nrc-ecargo-prototype:state'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === seed.SEED_VERSION && parsed.data) return parsed
    }
  } catch {
    // Storage unavailable or corrupt — fall back to seed data.
  }
  return createSeedState()
}

type Action =
  | { type: 'switch_persona'; personaId: string }
  | { type: 'reset_demo' }
  | { type: 'set_data'; data: AppData; applicantAppId?: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'switch_persona':
      return { ...state, personaId: action.personaId }
    case 'reset_demo':
      return createSeedState(state.personaId)
    case 'set_data':
      return { ...state, data: action.data, applicantAppId: action.applicantAppId ?? state.applicantAppId }
  }
}

interface StoreValue {
  state: AppState
  persona: Persona
  data: AppData
  applicantAppId: string
  switchPersona: (id: string) => void
  resetDemo: () => void
  /**
   * Run a pure workflow function against current data; on success the new data is committed.
   * `claimApplication` makes the demo applicant persona track the application the action created.
   */
  act: <T extends { applicationId?: string }>(fn: (data: AppData) => WorkflowResult<T>, opts?: { claimApplication?: boolean }) => WorkflowResult<T>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota / private-mode errors; the session still works in memory.
    }
  }, [state])

  const switchPersona = useCallback((personaId: string) => dispatch({ type: 'switch_persona', personaId }), [])
  const resetDemo = useCallback(() => dispatch({ type: 'reset_demo' }), [])

  const latest = useRef(state)
  latest.current = state

  const act = useCallback<StoreValue['act']>((fn, opts) => {
    const result = fn(latest.current.data)
    if (result.ok) {
      const next = { ...latest.current, data: result.data, applicantAppId: opts?.claimApplication && result.applicationId ? result.applicationId : latest.current.applicantAppId }
      latest.current = next
      dispatch({ type: 'set_data', data: result.data, applicantAppId: next.applicantAppId })
    }
    return result
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ state, persona: findPersona(state.personaId), data: state.data, applicantAppId: state.applicantAppId, switchPersona, resetDemo, act }),
    [state, switchPersona, resetDemo, act],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
