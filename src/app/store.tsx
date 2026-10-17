import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { AppData, Persona } from '@/types/domain'
import * as seed from '@/data/seed'
import { findPersona, DEFAULT_PERSONA_ID } from '@/data/personas'
import { authenticate, authenticateCustomer, expectedPassword, resolvePersona } from '@/lib/auth'
import { completeFirstLogin } from '@/lib/workflow/customerAdmin'
import { mailSignIn as checkMailSignIn } from '@/lib/mail'
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

/** `mail` = Mail Outbox mailboxes (keyed by email address); `notifications` = in-app bell (keyed by account). */
type Box = 'mail' | 'notifications'

type Action =
  | { type: 'switch_persona'; personaId: string }
  | { type: 'sign_out' }
  | { type: 'mail_session'; email: string | null }
  | { type: 'set_password'; username: string; password: string }
  | { type: 'read'; box: Box; key: string; ids: string[] }
  | { type: 'seen_all'; box: Box; key: string; at: string }
  | { type: 'reset_demo' }
  | { type: 'hydrate'; state: AppState }
  | { type: 'set_data'; data: AppData; applicantAppId?: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'switch_persona':
      return { ...state, personaId: action.personaId }
    case 'sign_out':
      return { ...state, personaId: null }
    case 'mail_session':
      return { ...state, mailUser: action.email }
    case 'set_password':
      return { ...state, passwords: { ...state.passwords, [action.username]: action.password } }
    case 'read': {
      const box = state[action.box]
      const have = box.read[action.key] ?? []
      const add = action.ids.filter((id) => !have.includes(id))
      return add.length ? { ...state, [action.box]: { ...box, read: { ...box.read, [action.key]: [...have, ...add] } } } : state
    }
    case 'seen_all': {
      const box = state[action.box]
      return { ...state, [action.box]: { ...box, seenUntil: { ...box.seenUntil, [action.key]: action.at } } }
    }
    case 'reset_demo':
      return createSeedState(state.personaId, state.mailUser)
    case 'hydrate':
      return action.state
    case 'set_data':
      return { ...state, data: action.data, applicantAppId: action.applicantAppId ?? state.applicantAppId }
  }
}

interface StoreValue {
  state: AppState
  persona: Persona
  /** False until a demo account has signed in. */
  signedIn: boolean
  data: AppData
  applicantAppId: string
  switchPersona: (id: string) => void
  /** Returns an error message, or null on success. */
  signIn: (username: string, password: string) => string | null
  signOut: () => void
  /** First sign-in: replace the temporary password. Returns an error message, or null on success. */
  changePassword: (current: string, next: string) => string | null
  /** In-app notifications (bell) for the signed-in account. */
  markNotificationsRead: (ids: string[]) => void
  markAllNotificationsRead: () => void
  /** Mail Outbox — simulated mailbox viewer with its own sign-in (by email address). */
  mailUser: string | null
  mailSignIn: (email: string, password: string) => string | null
  mailSignOut: () => void
  markMailRead: (ids: string[]) => void
  markAllMailRead: () => void
  resetDemo: () => void
  /**
   * Run a pure workflow function against current data; on success the new data is committed.
   * `claimApplication` makes the demo applicant persona track the application the action created.
   */
  act: <T extends object>(fn: (data: AppData) => WorkflowResult<T>, opts?: { claimApplication?: boolean }) => WorkflowResult<T>
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

  // Keep tabs in step (the Mail Outbox usually runs in its own tab): adopt whatever another tab saved.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as AppState
        if (next.version === seed.SEED_VERSION && next.data) { latest.current = next; dispatch({ type: 'hydrate', state: next }) }
      } catch { /* ignore malformed values */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const latest = useRef(state)
  latest.current = state

  const switchPersona = useCallback((personaId: string) => dispatch({ type: 'switch_persona', personaId }), [])
  const signIn = useCallback((username: string, password: string) => {
    const s = latest.current
    const id = authenticate(username, password, s.data, s.applicantAppId) ?? authenticateCustomer(username, password, s.data, s.applicantAppId, s.passwords)
    if (!id) return 'Incorrect username or password.'
    dispatch({ type: 'switch_persona', personaId: id })
    return null
  }, [])
  const signOut = useCallback(() => dispatch({ type: 'sign_out' }), [])
  const changePassword = useCallback((current: string, next: string) => {
    const s = latest.current
    const me = resolvePersona(findPersona(s.personaId ?? DEFAULT_PERSONA_ID), s.data, s.applicantAppId)
    const customer = s.data.customers.find((c) => c.id === me.customerId)
    if (!customer) return 'No company account is signed in.'
    if (current !== expectedPassword(customer.username, s.passwords)) return 'The current (temporary) password is not correct.'
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return 'Use at least 8 characters, with letters and numbers.'
    if (next === current) return 'Choose a password different from the temporary one.'
    const r = completeFirstLogin(s.data, customer.id, { name: me.name, role: me.role, customerId: customer.id })
    if (!r.ok) return r.error
    latest.current = { ...s, data: r.data, passwords: { ...s.passwords, [customer.username]: next } }
    dispatch({ type: 'set_data', data: r.data })
    dispatch({ type: 'set_password', username: customer.username, password: next })
    return null
  }, [])
  const now = () => new Date().toISOString()
  const markNotificationsRead = useCallback((ids: string[]) => { const k = latest.current.personaId; if (k) dispatch({ type: 'read', box: 'notifications', key: k, ids }) }, [])
  const markAllNotificationsRead = useCallback(() => { const k = latest.current.personaId; if (k) dispatch({ type: 'seen_all', box: 'notifications', key: k, at: now() }) }, [])
  const mailSignIn = useCallback((email: string, password: string) => {
    const s = latest.current
    const e = checkMailSignIn(email, password, s.data, s.applicantAppId)
    if (!e) return 'Unknown mailbox or wrong password.'
    dispatch({ type: 'mail_session', email: e })
    return null
  }, [])
  const mailSignOut = useCallback(() => dispatch({ type: 'mail_session', email: null }), [])
  const markMailRead = useCallback((ids: string[]) => { const k = latest.current.mailUser; if (k) dispatch({ type: 'read', box: 'mail', key: k, ids }) }, [])
  const markAllMailRead = useCallback(() => { const k = latest.current.mailUser; if (k) dispatch({ type: 'seen_all', box: 'mail', key: k, at: now() }) }, [])
  const resetDemo = useCallback(() => dispatch({ type: 'reset_demo' }), [])

  const act = useCallback<StoreValue['act']>((fn, opts) => {
    const result = fn(latest.current.data)
    if (result.ok) {
      const next = { ...latest.current, data: result.data, applicantAppId: opts?.claimApplication && 'applicationId' in result && typeof result.applicationId === 'string' ? result.applicationId : latest.current.applicantAppId }
      latest.current = next
      dispatch({ type: 'set_data', data: result.data, applicantAppId: next.applicantAppId })
    }
    return result
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      state, persona: resolvePersona(findPersona(state.personaId ?? DEFAULT_PERSONA_ID), state.data, state.applicantAppId), signedIn: state.personaId !== null,
      data: state.data, applicantAppId: state.applicantAppId, switchPersona, signIn, signOut, changePassword,
      markNotificationsRead, markAllNotificationsRead,
      mailUser: state.mailUser, mailSignIn, mailSignOut, markMailRead, markAllMailRead, resetDemo, act,
    }),
    [state, switchPersona, signIn, signOut, changePassword, markNotificationsRead, markAllNotificationsRead, mailSignIn, mailSignOut, markMailRead, markAllMailRead, resetDemo, act],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
