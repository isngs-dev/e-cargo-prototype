// NRC e-Cargo prototype — notification service (live email + SMS for every workflow stage).
// Run: node server/index.mjs   (see docs/DEPLOYMENT.md for the environment variables)
import http from 'node:http'
import { channelsConfigured, createLimiter, deliver, readConfig, validateRequest } from './notify.mjs'

const cfg = readConfig()
const limiter = createLimiter({ perDay: cfg.perDay, perRecipientPerHour: cfg.perRecipientPerHour })
const MAX_BODY = 10_000

function corsHeaders(origin) {
  const ok = !!origin && (cfg.allowedOrigins.includes('*') || cfg.allowedOrigins.includes(origin))
  return ok ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type' } : {}
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  const cors = corsHeaders(origin)
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const path = (req.url ?? '').split('?')[0]

  if (req.method === 'GET' && (path === '/' || path === '/api/health')) return send(res, 200, { ok: true, configured: channelsConfigured(cfg), smsBalance: cfg.lastSmsBalance || null }, cors)

  if (req.method === 'POST' && path === '/api/notify') {
    // Browsers from other sites are refused; direct non-browser callers send no Origin and are still limited by the caps below.
    if (origin && !cors['access-control-allow-origin']) return send(res, 403, { error: 'This site is not allowed to send messages.' })
    let raw = ''
    for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) return send(res, 413, { error: 'Request too large.' }, cors) }
    let body
    try { body = JSON.parse(raw) } catch { return send(res, 400, { error: 'Invalid JSON.' }, cors) }
    const v = validateRequest(body)
    if (!v.ok) return send(res, 400, { error: v.error }, cors)
    const out = await deliver(cfg, limiter, v.value)
    return send(res, out.status, out.body, cors)
  }
  send(res, 404, { error: 'Not found.' }, cors)
})

const port = Number(process.env.PORT) || 8787
server.listen(port, () => {
  const c = channelsConfigured(cfg)
  console.log(`NRC e-Cargo notification service on :${port} — email ${c.email ? 'ready' : 'NOT configured'}, SMS ${c.sms ? 'ready' : 'NOT configured'}`)
})
