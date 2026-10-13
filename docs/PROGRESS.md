# Progress

## Current phase

**Phase 3 (Registration workflow) complete** (2026-10-13). Phases 1–2 deployed to Render.

| Phase | Scope | Status |
|---|---|---|
| 1 | Requirements review, project setup, docs | ✅ Done |
| 2 | UI system, shell, navigation, role switcher, seeded dashboards | ✅ Foundation done |
| 3 | Registration workflow | ✅ Done |
| 4 | Booking creation & pricing | ⏭ Next |
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

## Phase 3 — completed

- `src/lib/workflow/registration.ts`: pure transitions (submit, resubmit, DS send-back/forward, Director approve/reject/send-back, internal remarks) with role + status + remark rules; each writes an audit entry. Approval creates the Customer with a unique username.
- Store `act()` commits workflow results; state version 2 (new `applicantAppId`; old localStorage is reseeded).
- Multi-step registration form (details → documents → review) with inline validation, simulated upload/preview/re-upload, "Fill demo data".
- `/registrations/:id` detail: stage tracker, details, document previews, automated checks, timeline (actor/role/time/status/remarks), role-specific action panels, eligibility form, reason dialogs.
- Applicant persona ("Obinna Chukwu") with dashboard, `/my-registration`, `/register`, `/registrations/:id/edit` (resubmit after send-back).
- 19 new tests (34 total).

## Validation results (2026-10-13)

| Command | Result |
|---|---|
| `npm test` | ✅ 34/34 passed |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ JS 421.8 kB (127.2 kB gzip), CSS 32.6 kB |
| Browser (dev server) | ✅ applicant resubmit → DS forward → Director approve (Priority 12% / 2 mo / ₦3M / Strategic) → customer created + audit trail; validation messages; document preview; no console errors |

## Known bugs / limitations

- Role switcher is not authentication; data is browser-local.
- Customers created by approval have no persona (cannot yet "log in" as them); bookings come in Phase 4.
- Facilitator "Re-upload" uses the browser file picker (name/size only); not automatable in my browser tests — use "Use sample file" for new docs.
- Eligibility edits for existing customers (upgrade between bookings) not built yet (Phase 7 / Director screen).
- No lint configured.

## Next task (exact)

**Phase 4 — Booking creation & pricing:**
1. `src/lib/workflow/booking.ts` (pure): create booking (validates mandatory fields/docs/hazardous doc/declaration, blocks if no rate or credit blocked or account suspended/blacklisted), computes indicative price via `lib/pricing`.
2. Multi-step `/bookings/new` form: date, cargo type, route, multiple container/wagon lines, weight, commodity, hazardous (+compliance doc), special handling, documents, live price breakdown (discount line only for Priority), Fair Cargo Policy declaration, preview & submit (no payment).
3. Booking detail page `/bookings/:id` (read-only for now): summary, pricing breakdown component, documents, timeline.
4. Tests for validation, missing rate block (APP-MNY non-containerized), credit block, suspended/blacklisted block.
5. Update PROGRESS.md.
