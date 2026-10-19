import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight, KeyRound, LogIn, ShieldCheck, TrainFront } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button, Input } from '@/components/ui/primitives'
import { demoAccounts, DEMO_PASSWORD, registeredCompanies } from '@/lib/auth'
import { findPersona } from '@/data/personas'
import { cn } from '@/lib/cn'

/** Sign-in page. The demo accounts beside the form fill the username and password when clicked. */
export function LoginPage() {
  const { signIn, signedIn, data } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string; username?: string } | null)?.notice
  const [username, setUsername] = useState((location.state as { username?: string } | null)?.username ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const staff = demoAccounts.filter((a) => !a.personaId.startsWith('p-fac')).map((a) => ({ key: a.username, title: a.label, sub: `${findPersona(a.personaId).name} · ${a.username}`, fill: a.username, password: a.password }))
  const seeded = demoAccounts.filter((a) => a.personaId.startsWith('p-fac')).map((a) => {
    const p = findPersona(a.personaId)
    const c = data.customers.find((x) => x.id === p.customerId)
    return { key: a.username, title: `${c?.companyName ?? p.title} (${c?.eligibility.isPriority ? 'Priority' : 'Non-Priority'})`, sub: `${p.name} · ${a.username}`, fill: a.username, password: a.password }
  })
  // Companies registered in this browser join the list once approved; each signs in with its contact email.
  const registered = registeredCompanies(data).map((c) => ({ key: c.id, title: `${c.companyName} (${c.eligibility.isPriority ? 'Priority' : 'Non-Priority'}, new)`, sub: `${c.poc.name} · ${c.poc.email}`, fill: c.poc.email, password: '' }))
  const groups = [{ title: 'NRC staff', rows: staff }, { title: 'Cargo facilitators', rows: [...seeded, ...registered] }]

  if (signedIn) return <Navigate to="/dashboard" replace />

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!username.trim() || !password) return setError('Enter your username and password.')
    const err = signIn(username, password)
    if (err) return setError(err)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="bg-brand-900 pb-24 text-brand-50">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3 rounded-md focus-visible:outline-brand-200" aria-label="NRC e-Cargo — back to the home page" title="Back to the home page">
            <span className="flex size-9 items-center justify-center rounded-md bg-white/10"><TrainFront className="size-5" aria-hidden /></span>
            <span className="leading-tight"><span className="block text-sm font-semibold text-white">NRC e-Cargo</span><span className="block text-[11px] text-brand-200">Operations Platform</span></span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-brand-100 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-4" aria-hidden /> Back to home page</Link>
        </header>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Sign in to NRC e-Cargo</h1>
          <p className="mt-2 max-w-xl text-sm text-brand-200">Registration, booking, approvals, payment, dispatch and AWB — one platform, every step recorded.</p>
        </div>
      </div>

      <main className="mx-auto -mt-16 w-full max-w-5xl flex-1 px-4 pb-10 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 p-6 sm:p-8" aria-label="Sign in">
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><KeyRound className="size-5" aria-hidden /></span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your credentials, or choose a demo account on the right.</p>
            <form ref={formRef} onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">Username or email address</span>
                <Input value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} autoComplete="username" autoFocus placeholder="Username or email" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">Password</span>
                <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} autoComplete="current-password" placeholder="••••••••" />
              </label>
              {notice && !error && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="h-10 w-full"><LogIn className="size-4" /> Sign in</Button>
            </form>
            <p className="mt-6 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden /> Demonstration prototype. Accounts and data are simulated and stay in this browser.</p>
            <p className="mt-2 text-xs text-slate-500">Emails the platform sends can be viewed in the simulated <Link to="/mail" className="font-medium text-brand-700 hover:underline">Mail Outbox</Link>.</p>
          </section>

          <section className="min-w-0 border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0" aria-label="Demo accounts">
            <h2 className="text-sm font-semibold text-slate-900">Demo accounts</h2>
            <p className="mt-1 text-xs text-slate-500">Click an account to fill in the sign-in form, then press <strong>Sign in</strong>. Password for the demo accounts: <span className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">{DEMO_PASSWORD}</span>. A company that registers appears under Facilitators once it is approved.</p>
            <div className="mt-4 space-y-4">
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
                  <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {g.rows.map((r) => {
                      const active = username.trim().toLowerCase() === r.fill.toLowerCase()
                      return (
                        <li key={r.key}>
                          <button type="button"
                            onClick={() => {
                              setUsername(r.fill); setPassword(r.password); setError('')
                              formRef.current?.querySelector<HTMLInputElement | HTMLButtonElement>(r.password ? 'button[type=submit]' : 'input[type=password]')?.focus()
                            }}
                            className={cn('group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-brand-50/60', active && 'bg-brand-50')}>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900">{r.title}</span>
                              <span className="block truncate text-xs text-slate-500">{r.sub}</span>
                            </span>
                            <ChevronRight className={cn('size-4 shrink-0 text-slate-300 group-hover:text-brand-600', active && 'text-brand-600')} aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
