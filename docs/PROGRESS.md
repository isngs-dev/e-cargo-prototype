# Progress

## Current phase

**Phase 1 complete · Phase 2 foundation complete** (2026-10-13)

| Phase | Scope | Status |
|---|---|---|
| 1 | Requirements review, project setup, docs | ✅ Done |
| 2 | UI system, shell, navigation, role switcher, seeded dashboards | ✅ Foundation done |
| 3 | Registration workflow | ⏭ Next |
| 4 | Booking creation & pricing | Planned |
| 5 | Booking approvals & payment simulation | Planned |
| 6 | Port operations, AWB, refunds | Planned |
| 7 | Super Admin, master data maintenance, audit | Planned |
| 8 | Integration testing, polish | Planned |

## Completed

- Vite + React 19 + TS 7 strict + Tailwind 4 + React Router 8 at project root; Render static-site config (`render.yaml`, SPA rewrite), `.gitignore`, `.node-version`.
- Docs: `CLAUDE.md`, `PROTOTYPE_SPEC.md`, `DECISIONS.md` (10 conflicts, 17 open items, 9 assumptions), `DEPLOYMENT.md`.
- Business-rule modules (`src/lib`): pricing (kobo, effective-dated rates, throws on missing rate, configurable tax basis), eligibility (discount cap, payment terms, credit threshold), dispatch gate, permissions/access matrix, registration checks (duplicate CAC, blacklist, incomplete docs), AWB number + check digit.
- Seed data: 6 customers (priority, non-priority, suspended, blacklisted), 10 registrations across all statuses, 13 bookings across all statuses (priced via the real pricing module), 3 routes / 12 rate rows incl. superseded row and a deliberately missing rate, 7 staff, refunds, payment exceptions, ~70 audit entries.
- Store: React context + reducer, persisted to localStorage, versioned, **Reset demo** dialog.
- App shell: sidebar (role-aware, mobile drawer), prototype banner, role switcher (7 personas incl. priority & non-priority facilitator).
- Role dashboards for all six roles with KPI cards and queues.
- Read-only screens: Bookings list (search + status filter, role-scoped), Registrations list (search + filter + automated check flags), Company Profile + eligibility/credit usage, Customers, Routes & Rates (current rates, history, tax config), Audit Log (search + entity filter).
- Unbuilt areas show an honest "Scheduled for phase N" page; unauthorized routes show an access-denied state.

## Validation results (2026-10-13)

| Command | Result |
|---|---|
| `npm test` | ✅ 15/15 passed (pricing examples ₦177,795 / ₦197,550, effective dating, missing rate, eligibility caps, credit block, dispatch gate, AWB check digit, seed integrity) |
| `npm run typecheck` (`tsc -b`) | ✅ no errors |
| `npm run build` | ✅ built; JS 380.6 kB (116.8 kB gzip), CSS 27.8 kB |
| Browser (dev server) | ✅ all 7 personas × 13 routes render; denied routes guarded; persona persists across reload; no console errors; no horizontal overflow at 375px |

No lint configured (ESLint deliberately not added; strict `tsc` covers type safety).

## Known bugs / limitations

- Role switcher is not authentication. All data is browser-local (see DEPLOYMENT.md).
- No workflow actions yet (approve/reject/send-back, booking form, payment, dispatch) — dashboards and lists are read-only.
- No detail views (booking/registration detail, timeline, document preview) yet.
- Seed timestamps fixed to Oct 2026; Master Data "rate in force today" uses the real current date.
- Rendered on SPA rewrite assumption — Render deployment not yet verified.

## Next task (exact)

**Phase 3 — Registration workflow:**
1. `src/lib/workflow/registration.ts`: pure transition functions (submit, DS send-back/forward, Director approve/reject/send-back) that validate role + current status, require remarks where mandated, and return `{ application, customer?, auditEntries }`.
2. Store actions wired to those functions (audit appended on each).
3. Public-style multi-step registration form for a *new* applicant (company details → documents with simulated upload/preview/re-upload → review & submit) with validation.
4. Registration detail page `/registrations/:id`: details, documents preview, automated checks, timeline, remarks; DS actions (send back w/ remarks, forward) and Director actions (eligibility form: priority, discount %, credit months, threshold, category; approve / reject / send back) with dialogs.
5. On approval: create Customer + simulated credentials notice; facilitator sees status & remarks after send-back and can resubmit.
6. Tests for every transition and permission; update PROGRESS.md.
