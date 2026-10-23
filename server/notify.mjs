// Live email + SMS for the NRC e-Cargo prototype (every workflow stage, to the contacts the presenter sets).
// Plain Node, no dependencies. Providers: Brevo or SendGrid (email) and KudiSMS (SMS). Keys come from environment variables only.

export const ALLOWED_KINDS = ['notification', 'test', 'registration_received', 'registration_resubmitted', 'registration_sent_back', 'registration_approved', 'registration_rejected']

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/
const PHONE_RE = /^\+[1-9]\d{9,14}$/

/** Validates and normalises one notification request. Returns { ok: true, value } or { ok: false, error }. */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' }
  const { kind, email, phone, name, subject, text, sms } = body
  if (!ALLOWED_KINDS.includes(kind)) return { ok: false, error: 'This kind of message is not allowed.' }
  const e = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const p = typeof phone === 'string' ? phone.replace(/[\s()-]/g, '') : ''
  if (!e && !p) return { ok: false, error: 'Provide an email address or a phone number.' }
  if (e && (!EMAIL_RE.test(e) || e.length > 120)) return { ok: false, error: 'The email address is not valid.' }
  if (p && !PHONE_RE.test(p)) return { ok: false, error: 'The phone number must be in international format, e.g. +2348031234567.' }
  if (e && (typeof subject !== 'string' || !subject.trim() || subject.length > 150)) return { ok: false, error: 'A short subject is required.' }
  if (e && (typeof text !== 'string' || !text.trim() || text.length > 2000)) return { ok: false, error: 'A message body is required (max 2000 characters).' }
  if (p && (typeof sms !== 'string' || !sms.trim() || sms.length > 320)) return { ok: false, error: 'An SMS text is required (max 320 characters).' }
  return { ok: true, value: { kind, email: e, phone: p, name: typeof name === 'string' ? name.trim().slice(0, 80) : '', subject: (subject ?? '').trim(), text: (text ?? '').trim(), sms: (sms ?? '').trim() } }
}

/** Abuse protection: a per-recipient hourly limit and a daily cap on everything this service sends. */
export function createLimiter({ perRecipientPerHour = 30, perDay = 300 } = {}) {
  const hits = new Map()
  let day = ''
  let dayCount = 0
  return {
    check(key, now = Date.now()) {
      const today = new Date(now).toISOString().slice(0, 10)
      if (today !== day) { day = today; dayCount = 0 }
      if (dayCount >= perDay) return { ok: false, error: 'The daily sending limit for this demo has been reached.' }
      const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000)
      if (recent.length >= perRecipientPerHour) return { ok: false, error: 'Too many messages to this recipient. Try again later.' }
      recent.push(now)
      hits.set(key, recent)
      dayCount += 1
      return { ok: true }
    },
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Minimal HTML email: green header band, the message, and an honest footer. */
export function buildHtml(name, text) {
  const body = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#04301f;color:#fff;padding:18px 24px;font-size:16px;font-weight:bold">NRC e-Cargo <span style="font-weight:normal;font-size:12px;color:#a9d8c1">· Nigerian Railway Corporation</span></td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.55">${name ? `<p style="margin:0 0 14px">Dear ${esc(name)},</p>` : ''}${body}<p style="margin:18px 0 0">Regards,<br>NRC e-Cargo Operations</p></td></tr>
<tr><td style="background:#f1f5f9;padding:12px 24px;font-size:11px;color:#64748b">Prototype demonstration message about your application. Reply is not monitored.</td></tr>
</table></td></tr></table></body></html>`
}

/** Email through Brevo's transactional API (free plan: 300/day). The sender address must be verified in Brevo. */
export async function sendEmailBrevo(cfg, { to, name, subject, text }, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: cfg.mailFromName, email: cfg.mailFrom },
      to: [{ email: to, ...(name ? { name } : {}) }],
      subject, htmlContent: buildHtml(name, text), textContent: text,
    }),
  })
  if (!res.ok) throw new Error(`Email provider answered ${res.status}`)
  return 'sent'
}

/** Email through SendGrid's v3 mail API. The sender address must be verified in SendGrid. */
export async function sendEmail(cfg, { to, name, subject, text }, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.sendgridKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, ...(name ? { name } : {}) }] }],
      from: { email: cfg.mailFrom, name: cfg.mailFromName },
      subject,
      content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: buildHtml(name, text) }],
    }),
  })
  if (!res.ok) throw new Error(`Email provider answered ${res.status}`)
  return 'sent'
}

/** SMS through KudiSMS. Numbers go without the leading +. Remembers the balance the provider reports. */
export async function sendSms(cfg, { to, message }, fetchImpl = fetch) {
  const res = await fetchImpl('https://my.kudisms.net/api/sms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: cfg.kudiToken, senderID: cfg.kudiSender, recipients: to.replace(/^\+/, ''), message, gateway: cfg.kudiGateway }),
  })
  if (!res.ok) throw new Error(`SMS provider answered ${res.status}`)
  let body = {}
  try { body = await res.json() } catch { /* mocked or empty body */ }
  if (body.balance) cfg.lastSmsBalance = String(body.balance)
  if (body.status && body.status !== 'success') throw new Error(`SMS provider said ${body.msg ?? body.status}`)
  return 'sent'
}

/** Current KudiSMS balance (used by `npm run credits`). */
export async function smsBalance(cfg, fetchImpl = fetch) {
  const res = await fetchImpl('https://my.kudisms.net/api/balance', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: cfg.kudiToken }),
  })
  return res.json()
}

export function readConfig(env = process.env) {
  return {
    sendgridKey: env.SENDGRID_API_KEY || '',
    brevoKey: env.BREVO_API_KEY || '',
    mailFrom: env.MAIL_FROM || '',
    mailFromName: env.MAIL_FROM_NAME || 'NRC e-Cargo',
    kudiToken: env.KUDISMS_TOKEN || '',
    kudiSender: env.KUDISMS_SENDER || '',
    kudiGateway: env.KUDISMS_GATEWAY || '2',
    lastSmsBalance: '',
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    perDay: Number(env.DAILY_CAP) || 300,
    perRecipientPerHour: Number(env.RECIPIENT_HOURLY_CAP) || 30,
  }
}

export const channelsConfigured = (cfg) => ({ email: !!((cfg.brevoKey || cfg.sendgridKey) && cfg.mailFrom), sms: !!(cfg.kudiToken && cfg.kudiSender) })

/**
 * Handle one validated request. Each channel reports 'sent', 'failed' or 'skipped' (no address, or not configured) —
 * one channel failing never blocks the other.
 */
export async function deliver(cfg, limiter, value, deps = {}) {
  const channels = channelsConfigured(cfg)
  const result = { email: 'skipped', sms: 'skipped' }
  const key = `${value.email}|${value.phone}`
  const allowed = limiter.check(key)
  if (!allowed.ok) return { status: 429, body: { error: allowed.error } }
  if (value.email && channels.email) {
    try { result.email = await (cfg.brevoKey ? sendEmailBrevo : sendEmail)(cfg, { to: value.email, name: value.name, subject: value.subject, text: value.text }, deps.fetch) } catch { result.email = 'failed' }
  }
  if (value.phone && channels.sms) {
    try { result.sms = await sendSms(cfg, { to: value.phone, message: value.sms }, deps.fetch) } catch { result.sms = 'failed' }
  }
  const anySent = result.email === 'sent' || result.sms === 'sent'
  const anyAttempted = result.email !== 'skipped' || result.sms !== 'skipped'
  return { status: anySent ? 200 : anyAttempted ? 502 : 503, body: { ...result, configured: channels } }
}
