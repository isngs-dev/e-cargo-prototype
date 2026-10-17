import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight, KeyRound, LogIn, ShieldCheck, TrainFront } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button, Input } from '@/components/ui/primitives'
import { applicantCompany, demoAccounts, DEMO_PASSWORD } from '@/lib/auth'
import { findPersona } from '@/data/personas'
import { cn } from '@/lib/cn'

/** Sign-in page. The demo accounts beside the form fill the username and password when clicked. */
export function LoginPage() {
  const { signIn, signedIn, data, applicantAppId } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string; username?: string } | null)?.notice
  const [username, setUsername] = useState((location.state as { username?: string } | null)?.username ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const company = applicantCompany(data, applicantAppId)

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
            <p className="mt-1 text-xs text-slate-500">Click a post to fill in the sign-in form, then press <strong>Sign in</strong>. Password for all: <span className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">{DEMO_PASSWORD}</span></p>
            <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {demoAccounts.map((a) => {
                const active = username.trim().toLowerCase() === (a.personaId === 'p-fac-applicant' && company ? company.poc.email.toLowerCase() : a.username)
                return (
                  <li key={a.username}>
                    <button type="button"
                      onClick={() => {
                        const newCompany = a.personaId === 'p-fac-applicant' && company
                        setUsername(newCompany ? company.poc.email : a.username); setPassword(newCompany ? '' : a.password); setError('')
                        formRef.current?.querySelector<HTMLInputElement>(newCompany ? 'input[type=password]' : 'button[type=submit]')?.focus()
                      }}
                      className={cn('group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-brand-50/60', active && 'bg-brand-50')}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{a.label}</span>
                        <span className="block truncate text-xs text-slate-500">{a.personaId === 'p-fac-applicant' && company ? `${company.companyName} — use your email and the temporary password from the welcome email` : findPersona(a.personaId).name}</span>
                      </span>
                      <ChevronRight className={cn('size-4 shrink-0 text-slate-300 group-hover:text-brand-600', active && 'text-brand-600')} aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
