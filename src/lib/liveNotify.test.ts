import { describe, expect, it } from 'vitest'
import { createSeedState } from '@/app/state'
import { defaultLiveSettings, pendingLive, registrationNotices, toE164 } from './liveNotify'
import type { AppData } from '@/types/domain'

describe('toE164', () => {
  it('joins the country code and drops the leading zero and spaces', () => {
    expect(toE164('+234', '0803 123 4567')).toBe('+2348031234567')
    expect(toE164('+234', '803-123-4567')).toBe('+2348031234567')
  })
})

describe('registrationNotices', () => {
  const base = createSeedState().data
  const app = base.applications[0]!
  const entry = (toStatus: string, action = 'Submitted', remarks = '') => ({
    id: 'a-x', entityType: 'registration', entityId: app.id, action, toStatus, remarks,
  }) as unknown as AppData['audit'][number]
  const after = (e: AppData['audit'][number]): AppData => ({ ...base, audit: [...base.audit, e] })

  it('creates a received notice with email, phone and SMS for the registrant', () => {
    const n = registrationNotices(base, after(entry('pending_district_verification')), 'https://x.test')[0]!
    expect(n.kind).toBe('registration_received')
    expect(n.email).toBe(app.poc.email)
    expect(n.phone).toMatch(/^\+\d{10,15}$/)
    expect(n.sms.length).toBeLessThanOrEqual(300)
    expect(n.id).toBe('m-a-x')
  })

  it('approval email carries sign-in details but the SMS does not', () => {
    const n = registrationNotices(base, after(entry('activated', 'Approved')), 'https://x.test')[0]!
    expect(n.kind).toBe('registration_approved')
    expect(n.text).toContain('Temporary password')
    expect(n.sms).not.toContain('demo1234')
    expect(n.id).toBe('m-a-x-welcome')
  })

  it('ignores non-registration and unrelated transitions', () => {
    const e = { ...entry('pending_district_verification'), entityType: 'booking' } as AppData['audit'][number]
    expect(registrationNotices(base, after(e), 'https://x.test')).toEqual([])
    expect(registrationNotices(base, after(entry('some_other_status')), 'https://x.test')).toEqual([])
  })
})

describe('pendingLive (every mail, to officers too)', () => {
  const base = createSeedState().data
  const app = base.applications[0]!
  const e = { id: 'a-y', at: '2026-10-20T10:00:00+01:00', entityType: 'registration', entityId: app.id, entityRef: app.reference, action: 'Application submitted', toStatus: 'pending_district_verification', remarks: '', actorName: 'X', actorRole: 'system' } as unknown as AppData['audit'][number]
  const after: AppData = { ...base, audit: [...base.audit, e] }

  it('never contacts seeded .demo addresses unless the presenter set a real contact', () => {
    const none = pendingLive(base, after, 'https://x.test', defaultLiveSettings())
    expect(none.every((n) => !n.email.endsWith('.demo'))).toBe(true)
    expect(none.map((n) => n.email)).not.toContain('c.obi@nrc.demo')
    const settings = { ...defaultLiveSettings(), contacts: { 'c.obi@nrc.demo': { email: 'sup@real.ng', phone: '+2348031112222' } } }
    const withDs = pendingLive(base, after, 'https://x.test', settings).find((n) => n.email === 'sup@real.ng')
    expect(withDs?.phone).toBe('+2348031112222')
    expect(withDs?.text).not.toContain('simulated email')
  })

  it('sends messages for demo people to the demo inbox, tagged with who they were for', () => {
    const settings = { ...defaultLiveSettings(), inbox: 'info@team.ng' }
    const out = pendingLive(base, after, 'https://x.test', settings)
    const ds = out.find((n) => n.subject.includes('District Supervisor'))
    expect(ds?.email).toBe('info@team.ng')
    expect(ds?.subject).toMatch(/^\[For District Supervisor/)
    expect(ds?.text).toContain('c.obi@nrc.demo')
    expect(ds?.phone).toBe('') // fake seeded phones are never texted
    expect(out.every((n) => n.email === 'info@team.ng')).toBe(true)
    expect(out.length).toBeGreaterThan(2) // applicant, supervisor and the copied MD / Director each get their tagged copy
  })

  it('respects the email and SMS switches', () => {
    const settings = { emailOn: false, smsOn: true, inbox: '', contacts: { 'c.obi@nrc.demo': { email: 'sup@real.ng', phone: '+2348031112222' } } }
    const out = pendingLive(base, after, 'https://x.test', settings)
    expect(out.every((n) => n.email === '')).toBe(true)
    expect(out.some((n) => n.phone === '+2348031112222')).toBe(true)
  })
})
