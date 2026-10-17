import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, CheckCheck, Mail } from 'lucide-react'
import { useStore } from '@/app/store'
import { useNotifications } from '@/features/mail/useMail'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

/** In-app notifications: the latest updates for the signed-in account. Full emails are in the simulated Mail Outbox. */
export function MailBell() {
  const { markNotificationsRead, markAllNotificationsRead } = useStore()
  const { items, unreadCount, isNew } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const latest = items.slice(0, 8)
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'} title="Notifications">
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button type="button" onClick={markAllNotificationsRead} disabled={!unreadCount} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40"><CheckCheck className="size-3.5" /> Mark all read</button>
          </div>
          {latest.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p> : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {latest.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => { markNotificationsRead([m.id]); setOpen(false); if (m.link) navigate(m.link) }}
                    className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', isNew(m.id) ? 'bg-brand-600' : 'bg-transparent')} />
                    <span className="min-w-0">
                      <span className={cn('block text-sm', isNew(m.id) ? 'font-semibold text-slate-900' : 'text-slate-700')}>{m.subject}</span>
                      <span className="block text-[11px] text-slate-400">{formatDateTime(m.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/mail" target="_blank" rel="noopener" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <Mail className="size-4" aria-hidden /> Open mail outbox
          </Link>
        </div>
      )}
    </div>
  )
}
