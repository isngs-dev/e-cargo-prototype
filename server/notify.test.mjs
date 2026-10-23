import { describe, expect, it } from 'vitest'
import { buildHtml, channelsConfigured, createLimiter, deliver, readConfig, validateRequest } from './notify.mjs'

const good = { kind: 'registration_received', email: 'Amaka@Sunrise.demo', phone: '+234 803 123 4567', name: 'Amaka Eze', subject: 'Application received', text: 'Hello', sms: 'Received' }
const cfgFull = readConfig({ SENDGRID_API_KEY: 'k', MAIL_FROM: 'noreply@x.ng', KUDISMS_TOKEN: 't', KUDISMS_SENDER: 'NRC' })

describe('validateRequest', () => {
  it('normalises email and phone, and accepts only registration message kinds', () => {
    const r = validateRequest(good)
    expect(r.ok && r.value).toMatchObject({ email: 'amaka@sunrise.demo', phone: '+2348031234567', kind: 'registration_received' })
    expect(validateRequest({ ...good, kind: 'marketing_blast' }).ok).toBe(false)
    expect(validateRequest({ ...good, kind: 'booking_approved' }).ok).toBe(false)
    expect(validateRequest({ ...good, kind: 'notification' }).ok).toBe(true)
  })
  it('rejects bad addresses, bad phones, missing text and oversize text', () => {
    expect(validateRequest({ ...good, email: 'not-an-email' }).ok).toBe(false)
    expect(validateRequest({ ...good, email: 'a@b.ng,c@d.ng' }).ok).toBe(false) // no multiple recipients
    expect(validateRequest({ ...good, phone: '08031234567' }).ok).toBe(false) // needs +country code
    expect(validateRequest({ ...good, subject: '' }).ok).toBe(false)
    expect(validateRequest({ ...good, text: 'x'.repeat(2001) }).ok).toBe(false)
    expect(validateRequest({ ...good, sms: 'x'.repeat(321) }).ok).toBe(false)
    expect(validateRequest({ ...good, email: '', phone: '' }).ok).toBe(false)
    expect(validateRequest(null).ok).toBe(false)
  })
  it('allows email-only or phone-only requests', () => {
    expect(validateRequest({ ...good, phone: '', sms: '' }).ok).toBe(true)
    expect(validateRequest({ ...good, email: '', subject: '', text: '' }).ok).toBe(true)
  })
})

describe('limiter', () => {
  it('limits per recipient per hour and per day', () => {
    const l = createLimiter({ perRecipientPerHour: 2, perDay: 3 })
    const t = Date.parse('2026-10-20T10:00:00Z')
    expect(l.check('a', t).ok).toBe(true)
    expect(l.check('a', t + 1000).ok).toBe(true)
    expect(l.check('a', t + 2000).ok).toBe(false) // third in the hour
    expect(l.check('a', t + 3_700_000).ok).toBe(true) // an hour later
    expect(l.check('b', t + 3_800_000).ok).toBe(false) // daily cap of 3 reached
    expect(l.check('b', t + 86_400_000).ok).toBe(true) // next day
  })
})

describe('deliver', () => {
  const ok = async () => ({ ok: true, status: 201 })
  const fail = async () => ({ ok: false, status: 401 })
  const v = validateRequest(good).value
  it('sends email and SMS through the providers', async () => {
    const calls = []
    const r = await deliver(cfgFull, createLimiter(), v, { fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 } } })
    expect(r).toMatchObject({ status: 200, body: { email: 'sent', sms: 'sent' } })
    expect(calls[0].url).toContain('sendgrid.com')
    expect(calls[0].body.personalizations[0].to[0].email).toBe('amaka@sunrise.demo')
    expect(calls[0].body.content[1].value).toContain('NRC e-Cargo')
    expect(calls[1].url).toContain('kudisms.net')
    expect(calls[1].body).toMatchObject({ recipients: '2348031234567', message: 'Received', senderID: 'NRC', gateway: '2' })
  })
  it('one channel failing does not block the other; nothing configured is reported, not faked', async () => {
    const mixed = await deliver(cfgFull, createLimiter(), v, { fetch: async (url) => (url.includes('sendgrid') ? { ok: false, status: 500 } : { ok: true, status: 200 }) })
    expect(mixed.body).toMatchObject({ email: 'failed', sms: 'sent' })
    expect(mixed.status).toBe(200)
    const none = await deliver(readConfig({}), createLimiter(), v, { fetch: ok })
    expect(none).toMatchObject({ status: 503, body: { email: 'skipped', sms: 'skipped' } })
    const bad = await deliver(cfgFull, createLimiter(), v, { fetch: fail })
    expect(bad.status).toBe(502)
  })
  it('is rate limited', async () => {
    const l = createLimiter({ perRecipientPerHour: 1 })
    expect((await deliver(cfgFull, l, v, { fetch: ok })).status).toBe(200)
    expect((await deliver(cfgFull, l, v, { fetch: ok })).status).toBe(429)
  })
})

describe('kudisms', () => {
  it('treats a provider error body as failed and records the balance on success', async () => {
    const cfg = readConfig({ KUDISMS_TOKEN: 't', KUDISMS_SENDER: 'NRC' })
    const v = validateRequest({ ...good, email: '' }).value
    const bad = await deliver(cfg, createLimiter(), v, { fetch: async () => ({ ok: true, status: 200, json: async () => ({ status: 'error', msg: 'low balance' }) }) })
    expect(bad.body.sms).toBe('failed')
    const okr = await deliver(cfg, createLimiter(), v, { fetch: async () => ({ ok: true, status: 200, json: async () => ({ status: 'success', balance: '1,200.50' }) }) })
    expect(okr.body.sms).toBe('sent')
    expect(cfg.lastSmsBalance).toBe('1,200.50')
  })
})

describe('helpers', () => {
  it('reports which channels are configured and escapes HTML in messages', () => {
    expect(channelsConfigured(cfgFull)).toEqual({ email: true, sms: true })
    expect(channelsConfigured(readConfig({ SENDGRID_API_KEY: 'k' }))).toEqual({ email: false, sms: false }) // needs a sender address too
    expect(buildHtml('A <b>', '<script>x</script>\n\nNext')).not.toContain('<script>')
    expect(buildHtml('A', 'Hi')).toContain('Dear A,')
  })
})

describe('brevo email', () => {
  it('is used when a Brevo key is set', async () => {
    const cfg = readConfig({ BREVO_API_KEY: 'b', MAIL_FROM: 'noreply@x.ng' })
    const urls = []
    const v = validateRequest({ ...good, phone: '', sms: '' }).value
    const r = await deliver(cfg, createLimiter(), v, { fetch: async (url) => { urls.push(url); return { ok: true, status: 201 } } })
    expect(r.body.email).toBe('sent')
    expect(urls[0]).toContain('brevo.com')
    expect(channelsConfigured(cfg).email).toBe(true)
  })
})
