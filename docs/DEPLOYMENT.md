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

None required. Do not commit `.env` files; `.gitignore` excludes them.

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
