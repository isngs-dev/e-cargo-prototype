# Deployment — Render (Static Site)

The prototype is a static SPA. No backend, database, Docker or secrets are required.

## Settings

| Setting | Value |
|---|---|
| Service type | Static Site |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Node version | `NODE_VERSION=22.12.0` (env var) — also pinned in `.node-version` |
| Rewrite rule | Source `/*` → Destination `/index.html` (Action: **Rewrite**) |
| Auto-deploy | On commit to the connected branch (Render default) |

`render.yaml` in the repo root declares the same configuration (Blueprint). Either:

- **Blueprint:** Render Dashboard → New → Blueprint → select the repo; Render reads `render.yaml`.
- **Manual:** New → Static Site → select the repo → enter the settings above → add the rewrite under *Redirects/Rewrites*.

The rewrite is required so that refreshing or opening deep links (e.g. `/bookings`, `/audit`) serves the app instead of a 404.

## Environment variables

None are required for the simulated demo. Do not commit `.env` files; `.gitignore` excludes them.

### Optional: live email + SMS (SendGrid + KudiSMS)

Every Mail Outbox message can also be delivered for real. Applicants and customers are messaged at the email and phone they typed; NRC officers at the contacts the presenter enters on **Live delivery setup** (`/live-setup`, also in the user menu; stored in that browser only, survives Reset demo). Seeded `.demo` addresses and their made-up phone numbers are never contacted. Payments stay simulated.

A small dependency-free service in `server/` (`npm run notify`) holds the provider keys; the browser never sees them. Without `VITE_NOTIFY_URL` the app keeps simulating and says so.

| Where | Variable | Purpose |
|---|---|---|
| Static site | `VITE_NOTIFY_URL` | Public URL of the notification service (set before the build) |
| Static site | `VITE_DEMO_INBOX` | Team mailbox that receives every message meant for a demo officer or demo company, subject tagged "[For <role — name>]" (editable on the setup page) |
| Service | `BREVO_API_KEY` (free, 300/day) or `SENDGRID_API_KEY` (paid), `MAIL_FROM`, `MAIL_FROM_NAME` | Email; Brevo is used if both are set; `MAIL_FROM` must be a verified sender |
| Service | `NBS_USERNAME`, `NBS_PASSWORD`, `NBS_SENDER` | SMS via Nigeria Bulk SMS (preferred when all three are set). Promotional SMS deliver 8 AM–8 PM Nigeria time only |
| Service | `KUDISMS_TOKEN`, `KUDISMS_SENDER` | SMS via KudiSMS; sender ID must be approved in the account |
| Service | `KUDISMS_GATEWAY` | Optional, default `2` |
| Service | `ALLOWED_ORIGINS` | Comma-separated site origins allowed to call it |
| Service | `DAILY_CAP`, `RECIPIENT_HOURLY_CAP` | Abuse limits (default 300/day, 30/hour per recipient; render.yaml raises them to 1500 / 400 because the demo inbox gets several copies per stage) |

Steps: create the `nrc-ecargo-notify` service from `render.yaml`, fill the keys in the Render dashboard, set `VITE_NOTIFY_URL` on the static site and redeploy it. `<service-url>/api/health` should show email and SMS `true`. Free Render services sleep, so the first message after idle can take about 30 seconds.

Credits: KudiSMS balance shows on the setup page after the first SMS, or run `npm run credits` with `KUDISMS_TOKEN` set. SendGrid's free plan allows 100 emails/day; check usage in its dashboard.

## Steps

1. Push the repository to GitHub (you perform this manually).
2. Create the Render service (Blueprint or manual, above).
3. Wait for the build to finish; open the `*.onrender.com` URL.
4. Smoke-test (see `docs/PROGRESS.md` → latest phase checklist), including a hard refresh on a nested route.

## localStorage limitations

- Prototype data lives in **each visitor's browser** (`localStorage` key `nrc-ecargo-prototype:state`).
- It is **not shared** between users, browsers, devices or incognito sessions; every new visitor starts from seed data.
- Clearing site data, or using **Reset demo**, restores the seed.
- It is **not** a production persistence solution and must not be presented as one.
