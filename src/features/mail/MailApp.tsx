import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ArrowLeft, CheckCheck, ChevronRight, ExternalLink, Inbox, LogIn, LogOut, Mail, Search, Send, ShieldCheck } from 'lucide-react'
import { useStore } from '@/app/store'
import { EmptyState } from '@/components/ui/blocks'
import { Button, Input } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { deliveryLine } from '@/lib/liveNotify'
import { buildMail, envelope, isCopyFor, isUnread, MAIL_PASSWORD, mailboxes, mailboxMessages, SENDER, SYSTEM_ADDRESS, type Address, type MailMessage } from '@/lib/mail'

/**
 * Mail Outbox — a simple simulated mailbox viewer (demo stand-in, not a mail product). It has its own sign-in (an email address), independent of the
 * e-Cargo platform login, and shows the simulated emails each person would receive in their own mailbox.
 */

function MailBrand({ dark = true }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn('flex size-8 items-center justify-center rounded-md', dark ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-700')}><Mail className="size-4.5" aria-hidden /></span>
      <span className="leading-tight">
        <span className={cn('block text-sm font-semibold', dark ? 'text-white' : 'text-slate-900')}>Mail Outbox</span>
        <span className={cn('block text-[11px]', dark ? 'text-blue-200' : 'text-slate-500')}>Simulated email · demo</span>
      </span>
    </span>
  )
}

// ---------------------------------------------------------------- sign-in

export function MailLoginPage() {
  const { data, applicantAppId, mailUser, mailSignIn } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const boxes = useMemo(() => mailboxes(data, applicantAppId), [data, applicantAppId])

  if (mailUser) return <Navigate to="/mail/inbox" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email address and password.')
    const err = mailSignIn(email, password)
    if (err) return setError(err)
    navigate('/mail/inbox', { replace: true })
  }

  const groups = ['NRC staff', 'Customers', 'Platform'] as const
  return (
    <div className="flex min-h-dvh flex-col bg-blue-50/60">
      <div className="bg-blue-800 pb-24">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <MailBrand />
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-blue-100 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-4" aria-hidden /> Back to NRC e-Cargo</Link>
        </header>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">View a mailbox</h1>
          <p className="mt-2 max-w-xl text-sm text-blue-100">A simulated outbox: pick an address to see the emails NRC e-Cargo would send to it. For demonstration only.</p>
        </div>
      </div>

      <main className="mx-auto -mt-16 w-full max-w-5xl flex-1 px-4 pb-10 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="p-6 sm:p-8" aria-label="Sign in">
            <h2 className="text-lg font-semibold text-slate-900">Open a mailbox</h2>
            <p className="mt-1 text-sm text-slate-500">Separate from the e-Cargo sign-in. Password for every address is shown on the right.</p>
            <form ref={formRef} onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">Email address</span>
                <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} autoComplete="email" autoFocus placeholder="name@nrc.demo" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">Password</span>
                <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} autoComplete="current-password" placeholder="••••••••" />
              </label>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="h-10 w-full bg-blue-700 hover:bg-blue-800"><LogIn className="size-4" /> Sign in</Button>
            </form>
            <p className="mt-6 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden /> Demonstration mail. Nothing is sent to real addresses; messages are generated from the e-Cargo audit log.</p>
          </section>

          <section className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0" aria-label="Demo mailboxes">
            <h2 className="text-sm font-semibold text-slate-900">Addresses</h2>
            <p className="mt-1 text-xs text-slate-500">Click an address to fill in the form. Password for all: <span className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">{MAIL_PASSWORD}</span>. A company that registers appears here under its contact email.</p>
            <div className="mt-4 space-y-4">
              {groups.map((g) => {
                const list = boxes.filter((b) => b.group === g)
                if (!list.length) return null
                return (
                  <div key={g}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g}</p>
                    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {list.map((b) => {
                        const active = email.trim().toLowerCase() === b.email.toLowerCase()
                        return (
                          <li key={b.email}>
                            <button type="button" onClick={() => { setEmail(b.email); setPassword(MAIL_PASSWORD); setError(''); formRef.current?.querySelector<HTMLButtonElement>('button[type=submit]')?.focus() }}
                              className={cn('group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50', active && 'bg-blue-50')}>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-slate-900">{b.label}</span>
                                <span className="block truncate text-xs text-slate-500">{b.name} · {b.email}</span>
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-slate-600" aria-hidden />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------- mailbox

const PAGE = 50
const fmtAddress = (a: Address) => `${a.name} <${a.email}>`

export function MailboxPage() {
  const { data, applicantAppId, mailUser, state, mailSignOut, markMailRead, markAllMailRead } = useStore()
  const navigate = useNavigate()
  const all = useMemo(() => buildMail(data), [data])
  const isSystem = mailUser === SYSTEM_ADDRESS
  const messages = useMemo(() => (mailUser ? mailboxMessages(all, mailUser, data) : []), [all, mailUser, data])
  const owner = useMemo(() => mailboxes(data, applicantAppId).find((b) => b.email.toLowerCase() === mailUser)
    ?? (mailUser ? { name: mailUser, email: mailUser, label: '', group: 'Customers' as const } : null), [data, applicantAppId, mailUser])
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = messages.find((m) => m.id === selectedId) ?? null

  useEffect(() => { if (selected && !isSystem) markMailRead([selected.id]) }, [selected, isSystem, markMailRead])

  if (!mailUser || !owner) return <Navigate to="/mail" replace />

  const unread = (m: MailMessage) => !isSystem && isUnread(m, mailUser, state.mail)
  const unreadCount = messages.filter(unread).length
  const q = query.trim().toLowerCase()
  const list = messages.filter((m) => (tab === 'all' || unread(m)) && (!q || m.subject.toLowerCase().includes(q) || m.body.join(' ').toLowerCase().includes(q)))

  return (
    <div className="flex h-dvh flex-col bg-blue-50/40">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-blue-800 px-4 text-white">
        <MailBrand />
        <div className="relative mx-auto hidden w-full max-w-md md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} placeholder="Search mail" aria-label="Search mail"
            className="h-9 w-full rounded-md border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-blue-200 focus:bg-white/15 focus:outline-none" />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-sm font-medium">{owner.name}</span>
            <span className="block text-[11px] text-blue-200">{mailUser}</span>
          </span>
          <button type="button" onClick={() => { mailSignOut(); navigate('/mail') }} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-blue-100 hover:bg-white/10 hover:text-white" title="Close this mailbox">
            <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Switch mailbox</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:flex">
          <div className={cn('flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900')}>
            <span className="inline-flex items-center gap-2">{isSystem ? <Send className="size-4" aria-hidden /> : <Inbox className="size-4" aria-hidden />}{isSystem ? 'Sent' : 'Inbox'}</span>
            <span className="text-xs tabular-nums">{isSystem ? messages.length : unreadCount || ''}</span>
          </div>
          <div className="mt-auto space-y-1 border-t border-slate-100 pt-3 text-xs">
            <Link to="/login" className="flex items-center gap-1.5 rounded px-2 py-1.5 text-slate-600 hover:bg-slate-100"><ExternalLink className="size-3.5" aria-hidden /> Back to NRC e-Cargo</Link>
            <p className="px-2 text-slate-400">Simulated · nothing is actually sent.</p>
          </div>
        </aside>

        <section className={cn('flex w-full min-w-0 flex-col border-r border-slate-200 bg-white md:w-96 md:shrink-0', selected && 'hidden md:flex')} aria-label={isSystem ? 'Sent' : 'Inbox'}>
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <h1 className="text-sm font-semibold text-slate-900">{isSystem ? `Sent · ${messages.length}` : 'Inbox'}</h1>
            {!isSystem && (
              <div className="flex items-center gap-1">
                {(['all', 'unread'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setTab(t); setLimit(PAGE) }} aria-pressed={tab === t}
                    className={cn('rounded px-2 py-1 text-xs font-medium', tab === t ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100')}>{t === 'all' ? 'All' : `Unread ${unreadCount}`}</button>
                ))}
                <button type="button" onClick={markAllMailRead} disabled={!unreadCount} title="Mark all as read" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><CheckCheck className="size-4" /></button>
              </div>
            )}
          </div>
          <div className="border-b border-slate-100 p-2 md:hidden">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" aria-label="Search mail" />
          </div>
          {list.length === 0 ? (
            <EmptyState icon={Mail} title={q ? 'No mail matches' : tab === 'unread' ? 'No unread mail' : 'No mail yet'} description={q ? undefined : 'Emails arrive here as work moves through each stage in NRC e-Cargo.'} />
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {list.slice(0, limit).map((m) => {
                const isNew = unread(m)
                const env = isSystem ? envelope(m, data) : null
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelectedId(m.id)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', selectedId === m.id && 'bg-blue-50')}>
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', isNew ? 'bg-blue-600' : 'bg-transparent')} aria-label={isNew ? 'Unread' : undefined} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-xs', isNew ? 'font-semibold text-slate-900' : 'text-slate-600')}>{env ? `To: ${env.to.map((a) => a.name).join(', ') || '—'}` : 'NRC e-Cargo'}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(m.at).replace(/, \d{4}/, '')}</span>
                        </span>
                        <span className={cn('mt-0.5 block truncate text-sm', isNew ? 'font-semibold text-slate-900' : 'text-slate-800')}>{m.subject}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{m.body[0]}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {list.length > limit && <li className="p-3 text-center"><Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>Show more</Button></li>}
            </ul>
          )}
        </section>

        <section className={cn('min-w-0 flex-1 overflow-y-auto', !selected && 'hidden md:block')} aria-label="Message">
          {selected ? <MessageView m={selected} viewer={owner} isSystem={isSystem} onBack={() => setSelectedId(null)} /> : (
            <div className="flex h-full items-center justify-center p-6"><EmptyState icon={Mail} title="Select a message" description="Choose an email from the list to read it." /></div>
          )}
        </section>
      </div>
    </div>
  )
}

function MessageView({ m, viewer, isSystem, onBack }: { m: MailMessage; viewer: Address; isSystem: boolean; onBack: () => void }) {
  const { data, state } = useStore()
  const lives = Object.entries(state.liveDelivery).filter(([id]) => id === m.id || id.startsWith(`${m.id}|`)).map(([, d]) => d)
  const env = envelope(m, data)
  const copied = isCopyFor(m, viewer.email, data)
  const greetingName = isSystem ? (env.to[0]?.name ?? 'colleague') : viewer.name
  const disclaimer = m.body[m.body.length - 1]
  const lines = m.body.slice(0, -1)
  return (
    <article className="mx-auto max-w-3xl p-4 sm:p-6">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 md:hidden"><ArrowLeft className="size-4" /> Back</button>
      <h2 className="text-xl font-semibold text-slate-900">{m.subject}</h2>
      <div className="mt-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">NE</span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-slate-900">{SENDER}</span>
            <span className="text-xs text-slate-500">{formatDateTime(m.at)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600"><span className="text-slate-400">To:</span> {env.to.length ? env.to.map(fmtAddress).join(', ') : '—'}</p>
          {env.cc.length > 0 && <p className="text-xs text-slate-600"><span className="text-slate-400">Cc:</span> {env.cc.map(fmtAddress).join(', ')}</p>}
          {lives.filter((live) => deliveryLine(live)).map((live, i) => <p key={i} className="mt-1 rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">Also delivered live: {deliveryLine(live)}</p>)}
          {copied && <p className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">You are copied for information</p>}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 bg-brand-900 px-6 py-4 text-white">
          <span className="text-sm font-semibold">NRC e-Cargo</span><span className="text-xs text-brand-200">· Nigerian Railway Corporation</span>
        </div>
        <div className="space-y-3 px-6 py-6 text-sm leading-relaxed text-slate-700">
          <p>Dear {greetingName},</p>
          {lines.map((l, i) => <p key={i} className={cn(/^(Sign-in email|Temporary password):/.test(l) && 'rounded-md bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-900 ring-1 ring-slate-200')}>{l}</p>)}
          {m.link && (
            <p className="pt-2"><Link to={m.link} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Open in NRC e-Cargo <ExternalLink className="size-3.5" aria-hidden /></Link></p>
          )}
          <p className="pt-2">Regards,<br />NRC e-Cargo Operations</p>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-[11px] text-slate-500">{disclaimer}</div>
      </div>
    </article>
  )
}
