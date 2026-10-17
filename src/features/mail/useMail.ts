import { useMemo } from 'react'
import { useStore } from '@/app/store'
import { buildMail, inboxFor, isUnread } from '@/lib/mail'

/** In-app notifications for the signed-in account (the bell). Email itself is in the simulated Mail Outbox. */
export function useNotifications() {
  const { data, persona, applicantAppId, state } = useStore()
  const all = useMemo(() => buildMail(data), [data])
  const items = useMemo(() => inboxFor(all, { persona, applicantAppId }), [all, persona, applicantAppId])
  const unreadCount = useMemo(() => items.filter((m) => isUnread(m, persona.id, state.notifications)).length, [items, persona.id, state.notifications])
  return { items, unreadCount, isNew: (id: string) => { const m = items.find((x) => x.id === id); return !!m && isUnread(m, persona.id, state.notifications) } }
}
