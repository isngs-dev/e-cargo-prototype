import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ArrowLeft, CircleCheck, KeyRound, ShieldCheck, TrainFront } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button, Input } from '@/components/ui/primitives'

const rules = [
  { ok: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { ok: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p), label: 'Letters and numbers' },
]

/** First sign-in: the customer replaces the temporary password from the welcome email, then signs in again. */
export function ChangePasswordPage() {
  const { signedIn, persona, data, changePassword, signOut } = useStore()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)

  const customer = data.customers.find((c) => c.id === persona.customerId)
  if (finished) return null
  if (!signedIn) return <Navigate to="/login" replace />
  if (!customer?.firstLogin) return <Navigate to="/dashboard" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!current || !next || !confirm) return setError('Fill in all three fields.')
    if (next !== confirm) return setError('The new password and its confirmation do not match.')
    const err = changePassword(current, next)
    if (err) return setError(err)
    setFinished(true)
    signOut()
    navigate('/login', { replace: true, state: { notice: 'Your password has been set. Sign in with your new password to continue.', username: customer.poc.email } })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="bg-brand-900 pb-24 text-brand-50">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3 rounded-md focus-visible:outline-brand-200" aria-label="NRC e-Cargo — back to the home page">
            <span className="flex size-9 items-center justify-center rounded-md bg-white/10"><TrainFront className="size-5" aria-hidden /></span>
            <span className="leading-tight"><span className="block text-sm font-semibold text-white">NRC e-Cargo</span><span className="block text-[11px] text-brand-200">Operations Platform</span></span>
          </Link>
          <button type="button" onClick={() => { signOut(); navigate('/login') }} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-brand-100 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-4" aria-hidden /> Sign out</button>
        </header>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Set your password</h1>
          <p className="mt-2 max-w-xl text-sm text-brand-200">Welcome, {persona.name}. For your security, replace the temporary password from your welcome email before you continue.</p>
        </div>
      </div>

      <main className="mx-auto -mt-16 w-full max-w-xl flex-1 px-4 pb-10 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><KeyRound className="size-5" aria-hidden /></span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{customer.companyName}</h2>
          <p className="mt-1 text-sm text-slate-500">Signed in as <span className="font-mono text-slate-700">{customer.poc.email}</span></p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">Current (temporary) password</span>
              <Input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setError('') }} autoComplete="current-password" autoFocus />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">New password</span>
              <Input type="password" value={next} onChange={(e) => { setNext(e.target.value); setError('') }} autoComplete="new-password" />
            </label>
            <ul className="space-y-1 text-xs">
              {rules.map((r) => <li key={r.label} className={r.ok(next) ? 'text-emerald-700' : 'text-slate-500'}><CircleCheck className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />{r.label}</li>)}
            </ul>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">Confirm new password</span>
              <Input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }} autoComplete="new-password" />
            </label>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="h-10 w-full">Set password and continue</Button>
          </form>
          <p className="mt-6 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden /> After saving you sign in again with the new password. Demonstration: the password stays in this browser only.</p>
        </div>
      </main>
    </div>
  )
}
