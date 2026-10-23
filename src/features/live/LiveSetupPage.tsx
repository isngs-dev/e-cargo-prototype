import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Send } from 'lucide-react'
import { useStore } from '@/app/store'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Button, Card, Input } from '@/components/ui/primitives'
import { roleLabels } from '@/lib/permissions'
import {
  fetchHealth, LIVE_URL, loadLiveSettings, saveLiveSettings, sendLive, toE164, type Health, type LiveSettings,
} from '@/lib/liveNotify'

/** "0803 123 4567" → +2348031234567; "+44 7700 900123" stays international. */
function normalisePhone(v: string): string {
  const t = v.trim()
  if (!t) return ''
  return t.startsWith('+') ? `+${t.replace(/\D/g, '')}` : toE164('+234', t)
}

/** Presenter page: real email / phone for each officer, and the two switches. Stored in this browser only. */
export function LiveSetupPage() {
  const { data } = useStore()
  const [settings, setSettings] = useState<LiveSettings>(loadLiveSettings)
  const [health, setHealth] = useState<Health | null | undefined>(undefined)
  const [tested, setTested] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { void fetchHealth().then(setHealth) }, [])

  const rows = [
    ...data.staff.filter((s) => s.status === 'active').map((s) => ({ key: s.email.toLowerCase(), name: s.name, label: `${roleLabels[s.role]}${s.district ? ` (${s.district})` : ''}` })),
    ...data.customers.filter((c) => c.id === 'cus-lagoon' || c.id === 'cus-gateway').map((c) => ({ key: c.poc.email.toLowerCase(), name: c.poc.name, label: `${c.companyName} (demo customer)` })),
  ]

  const edit = (key: string, patch: { email?: string; phone?: string }) => {
    setSaved(false)
    setSettings((s) => ({ ...s, contacts: { ...s.contacts, [key]: { email: '', phone: '', ...s.contacts[key], ...patch } } }))
  }
  const save = () => {
    const contacts: LiveSettings['contacts'] = {}
    for (const [k, c] of Object.entries(settings.contacts)) if (c.email.trim() || c.phone.trim()) contacts[k] = { email: c.email.trim(), phone: normalisePhone(c.phone) }
    const next = { ...settings, inbox: settings.inbox.trim(), contacts }
    setSettings(next)
    saveLiveSettings(next)
    setSaved(true)
  }
  const test = async (key: string, name: string, label: string) => {
    const c = settings.contacts[key] ?? { email: '', phone: '' }
    const email = c.email.trim() || settings.inbox.trim()
    setTested((t) => ({ ...t, [key]: 'Sending…' }))
    const r = await sendLive({
      id: `test-${key}`, appId: '', kind: 'test', email, phone: normalisePhone(c.phone), name,
      subject: `[For ${label} — ${name}] NRC e-Cargo — test message`.slice(0, 150),
      text: `This is a test message from the NRC e-Cargo prototype for ${label}. If you can read this, live delivery for this role works.`,
      sms: 'NRC e-Cargo: test message. Live delivery to this number works.',
    })
    const part = (w: string, s: string) => (s === 'skipped' ? '' : `${w} ${s}`)
    setTested((t) => ({ ...t, [key]: [part('Email', r.email), part('SMS', r.sms)].filter(Boolean).join(' · ') || 'Nothing to send' }))
  }

  const toggle = (k: 'emailOn' | 'smsOn', label: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={settings[k]} onChange={(e) => { setSaved(false); setSettings((s) => ({ ...s, [k]: e.target.checked })) }} className="size-4" /> {label}
    </label>
  )

  return (
    <PublicLayout>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Live delivery setup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every email in the Mail Outbox can also be sent for real. Messages for demo officers and demo companies go to the demo inbox; companies that register with a real email are messaged at the details they typed. Seeded <span className="font-mono">.demo</span> addresses and phone numbers are never contacted. SMS goes only to phones entered below or typed at registration.
        </p>

        <Card className="mt-6 p-4">
          {!LIVE_URL ? (
            <p className="flex items-center gap-2 text-sm text-amber-800"><CircleAlert className="size-4" aria-hidden /> No notification service is connected to this site, so everything stays simulated.</p>
          ) : health === undefined ? <p className="text-sm text-slate-500">Checking the notification service…</p>
            : health === null ? <p className="flex items-center gap-2 text-sm text-red-700"><CircleAlert className="size-4" aria-hidden /> The notification service did not answer. It may be waking up — reload in 30 seconds.</p>
              : (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1.5"><CircleCheck className="size-4 text-emerald-600" aria-hidden /> Service connected</span>
                  <span>Email: <strong>{health.configured.email ? 'ready' : 'not set up'}</strong></span>
                  <span>SMS: <strong>{health.configured.sms ? 'ready' : 'not set up'}</strong></span>
                  <span>SMS balance: <strong>{health.smsBalance ? `₦${health.smsBalance}` : 'shown after the first SMS'}</strong></span>
                </p>
              )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="demo-inbox">Demo inbox</label>
            <p className="text-xs text-slate-500">Receives every email meant for a demo officer or demo company, with the subject showing who it was for. Leave a row below empty to use it; fill a row to send that role somewhere else.</p>
            <Input id="demo-inbox" type="email" className="mt-1.5 max-w-sm" placeholder="info@yourcompany.com" value={settings.inbox} onChange={(e) => { setSaved(false); setSettings((s) => ({ ...s, inbox: e.target.value })) }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3">
            {toggle('emailOn', 'Send emails')}
            {toggle('smsOn', 'Send SMS (uses credits)')}
          </div>
        </Card>

        <Card className="mt-4 divide-y divide-slate-100">
          {rows.map((r) => {
            const c = settings.contacts[r.key] ?? { email: '', phone: '' }
            return (
              <div key={r.key} className="grid gap-3 p-4 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.label}</p>
                  <p className="truncate text-xs text-slate-500">{r.name}</p>
                </div>
                <Input type="email" placeholder={settings.inbox.trim() ? `→ ${settings.inbox.trim()}` : 'real email address'} aria-label={`Email for ${r.label}`} value={c.email} onChange={(e) => edit(r.key, { email: e.target.value })} />
                <Input type="tel" placeholder="0803 123 4567" aria-label={`Phone for ${r.label}`} value={c.phone} onChange={(e) => edit(r.key, { phone: e.target.value })} />
                <Button variant="secondary" disabled={!LIVE_URL || (!c.email && !c.phone && !settings.inbox.trim())} onClick={() => void test(r.key, r.name, r.label)}><Send className="size-4" aria-hidden /> Test</Button>
                {tested[r.key] && <p className="text-xs text-slate-600 md:col-span-4" role="status">{tested[r.key]}</p>}
              </div>
            )
          })}
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Save</Button>
          {saved && <span role="status" className="text-sm text-emerald-700">Saved in this browser. Reset demo does not clear it.</span>}
        </div>
        <p className="mt-4 text-xs text-slate-500">Only enter details of people who agreed to receive demo messages. Payments are still simulated.</p>
      </section>
    </PublicLayout>
  )
}
