import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type {
  AuditEntry,
  Booking,
  Customer,
  FreightRate,
  PaymentException,
  Persona,
  PlatformConfig,
  Refund,
  RegistrationApplication,
  Route,
  StaffAccount,
} from '@/types/domain'
import * as seed from '@/data/seed'
import { DEFAULT_PERSONA_ID, findPersona } from '@/data/personas'

/**
 * Prototype state, persisted to this browser's localStorage only.
 * Not shared between users, browsers or devices. Not a production persistence layer.
 */
export interface AppData {
  customers: Customer[]
  applications: RegistrationApplication[]
  bookings: Booking[]
  routes: Route[]
  freightRates: FreightRate[]
  staff: StaffAccount[]
  audit: AuditEntry[]
  refunds: Refund[]
  paymentExceptions: PaymentException[]
  config: PlatformConfig
  counters: typeof seed.counters
}

export interface AppState {
  version: number
  personaId: string
  data: AppData
}

const STORAGE_KEY = 'nrc-ecargo-prototype:state'

export function createSeedState(personaId = DEFAULT_PERSONA_ID): AppState {
  return structuredClone({
    version: seed.SEED_VERSION,
    personaId,
    data: {
      customers: seed.customers,
      applications: seed.applications,
      bookings: seed.bookings,
      routes: seed.routes,
      freightRates: seed.freightRates,
      staff: seed.staff,
      audit: seed.audit,
      refunds: seed.refunds,
      paymentExceptions: seed.paymentExceptions,
      config: seed.config,
      counters: seed.counters,
    },
  })
}

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

type Action = { type: 'switch_persona'; personaId: string } | { type: 'reset_demo' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'switch_persona':
      return { ...state, personaId: action.personaId }
    case 'reset_demo':
      return createSeedState(state.personaId)
  }
}

interface StoreValue {
  state: AppState
  persona: Persona
  data: AppData
  switchPersona: (id: string) => void
  resetDemo: () => void
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

  const value = useMemo<StoreValue>(
    () => ({ state, persona: findPersona(state.personaId), data: state.data, switchPersona, resetDemo }),
    [state, switchPersona, resetDemo],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
