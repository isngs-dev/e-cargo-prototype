# Progress

## Current phase

**Phase 8 (integration, polish & extras) complete** (2026-10-14). All eight planned phases are done.

| Phase | Scope | Status |
|---|---|---|
| 1 | Requirements review, project setup, docs | ✅ Done |
| 2 | UI system, shell, navigation, role switcher, seeded dashboards | ✅ Foundation done |
| 3 | Registration workflow | ✅ Done |
| 4 | Booking creation & pricing | ✅ Done |
| 5 | Booking approvals & payment simulation | ✅ Done |
| 6 | Port operations, AWB, refunds | ✅ Done |
| 7 | Super Admin, master data maintenance, audit | ✅ Done |
| 8 | Integration testing, polish & extras | ✅ Done |
| 9 | Reports & Analytics (executive dashboard) | ✅ Done |

## Completed

- Vite + React 19 + TS 7 strict + Tailwind 4 + React Router 8 at project root; Render static-site config (`render.yaml`, SPA rewrite), `.gitignore`, `.node-version`.
- Docs: `CLAUDE.md`, `PROTOTYPE_SPEC.md`, `DECISIONS.md` (11 conflicts, 18 open items, 49 assumptions), `DEPLOYMENT.md`.
- Business-rule modules (`src/lib`): pricing (kobo, effective-dated rates, throws on missing rate, configurable tax basis), eligibility (discount cap, payment terms, credit threshold), dispatch gate, permissions/access matrix, registration checks (duplicate CAC, blacklist, incomplete docs), AWB number + check digit.
- Seed data: 6 customers (priority, non-priority, suspended, blacklisted), 10 registrations across all statuses, 13 bookings across all statuses (priced via the real pricing module), 3 routes / 12 rate rows incl. superseded row and a deliberately missing rate, 7 staff, refunds, payment exceptions, ~70 audit entries.
- Store: React context + reducer, persisted to localStorage, versioned, **Reset demo** dialog.
- App shell: sidebar (role-aware, mobile drawer), role switcher (9 personas).
- Role dashboards for all six roles with KPI cards and queues.
- Read-only screens: Bookings list (search + status filter, role-scoped), Registrations list (search + filter + automated check flags), Company Profile + eligibility/credit usage, Customers, Routes & Rates (current rates, history, tax config), Audit Log (search + entity filter).
- Unbuilt areas show an honest "Scheduled for phase N" page; unauthorized routes show an access-denied state.

## Phase 9 — Reports & Analytics (completed)

- New `/reports` page for the Director and Super Admin only (nav item `reports` + route guard; direct URL access blocked for every other role and the demo applicant).
- `src/lib/reports.ts`: pure aggregation (`buildReport`) — period resolution from the latest data, previous-period comparison, KPIs, trend series (day / week / month), breakdowns by district and route, status distributions, Priority vs Non-Priority, revenue position, record tables. No component calculates a figure.
- `src/features/reports/`: `ReportsPage.tsx` (one unified dashboard) and `charts.tsx` (dependency-free SVG/HTML line chart with tooltip, donut, comparison bars, split bars, KPI card). No new dependency.
- Revenue = paid / credit-settled bookings at the frozen total, dated by payment date; refunds = processed, unreversed; net = gross − refunds; receivables (awaiting payment, approved credit) are shown separately and never counted as revenue (A-50 … A-56, D-19).
- Seed: 16 historical demonstration bookings (Aug–Sep 2026) and one processed refund so trends have real data; `SEED_VERSION` 7 (A-57).
- Small fixes: refund-flow test now filters by refund id; the Director's price-freeze confirmation validates before opening.
- 31 new tests in `reports.test.ts` (181 total): KPIs and date ranges, district filtering (both districts), status mapping, revenue accuracy (unpaid / credit excluded, no double counting), refunds and net, empty and missing data, access for every role and persona.

## Phase 8 — completed

- **Refunds and payment exceptions are now clickable cards** that open their own pages: `/refunds` and `/payments` list summary cards (with an "action needed" hint and filters); the actions live on `/refunds/:id` and `/payments/:id`. The refund page also hosts the facilitator's request form and the reversal.
- **End-to-end tests** (`journey.test.ts`): the full happy path, credit path, send-back loops, HoC / Director rejection, auto-cancel, and physical-failure → refund → reversal, each ending with audit-trail invariants (statuses chain without gaps, time never goes backwards, every entry has an actor and role). This found and fixed a real gap: refund creation was not audited.
- **Capacity & waitlist (simulated, D-6):** `lib/capacity.ts`, live availability in the booking form, blocking + waitlist, `/capacity` dashboard, Super Admin capacity / maintenance-block editing.
- **Approval ageing (D-9, proposed targets):** `lib/sla.ts`, "Waiting" column in registration and booking queues, targets editable in configuration.
- **AWB amendment (new versions, superseded kept) and a public `/verify` page** (valid / superseded / not found / forged number); the AWB QR now encodes the verification URL.
- **Refund reversal** (separate reversing entry).
- **Public landing page** (`/`) with services, train availability, FAQ, placeholders for NRC policy and contact; the platform is at `/dashboard`.
- **Stakeholder demo guide** (`/demo-guide`): five scenes whose "Go" buttons switch role and open the right page.
- **Polish:** one shared `Flash` message component, clickable KPI cards, page titles, skip-to-content link, print-friendly AWB.
- State version 6 (capacity, waitlist, reversals, SLA config). 25 new tests (150 total).

## Phase 7 — completed

- `src/lib/workflow/staff.ts`: create account (simulated credentials, forced first-login change), edit, reset password, suspend / reactivate / revoke (permanent), reassign role + district — Super Admin only, reasons enforced, all audited.
- `src/lib/workflow/masterData.ts`: insert effective-dated freight rates (never edit/delete, not back-dated), add / deactivate routes, update platform configuration (tax/levy rates, basis, payment / reminder / refund windows, tax-certificate rule) with one audit entry per changed setting. Frozen booking prices are never affected.
- `src/lib/workflow/customerAdmin.ts`: suspend / blacklist / reactivate (Director or Super Admin); Director-only eligibility change (never retroactive; old → new logged); Super Admin record correction (address / contact only).
- `src/lib/workflow/paymentException.ts`: match to an exact-amount open invoice, start a duplicate-payment refund, or return — Super Admin, simulated.
- Screens: `/staff`, master-data editing dialogs (`/master-data`), `/customers/:id`, `/payments`, audit log with actor-role and date filters plus CSV export (`src/lib/csv.ts`). All placeholder pages are gone.
- State version 5 (payment-exception shape; seeded third exception matching an open invoice).
- 26 new tests (125 total).

## Phase 6 — completed

- `src/lib/workflow/dispatch.ts` (pure): `approveDispatch` (gate: paid or credit-approved only; mandatory wagon/train/date/time; full physical-verification checklist; **idempotent** AWB generation — repeat returns the same AWB, no number consumed, no extra audit), `failPhysicalVerification` (mandatory reason; capacity released; refund created when money was received; unpaid credit cancelled), `completeBooking`.
- `src/lib/workflow/refund.ts` (pure): Director `triggerRefund`, facilitator `submitRefundRequest` (validation, 30-day window, masked account only), Super Admin `advanceRefund` review → approve → process (cannot skip; separation of duties enforced).
- Screens: dispatch panel on the booking page (Head of Port), `/dispatch` queue, AWB preview `/bookings/:id/awb` (QR via `qrcode.react`, demo-labelled, printable), `/awbs` register, `/refunds` (role-specific actions, progress tracker, history), "View AWB" on the booking for every permitted role.
- New dependency: `qrcode.react` (4.2.0, ISC, 134 KB). Run `npm install` after pulling.
- State version 4 (refund shape changed; old saved demo data reseeds).
- 21 new tests (99+ total).

## Phase 5 — completed

- `src/lib/workflow/bookingApproval.ts` (pure): Head of Cargo approve / send back / reject; Director approve (final discount ≤ eligible and none for Non-Priority, reason when below max, payment terms, credit ≤ eligible and within threshold, price recalculated and **frozen** with an eligibility snapshot, invoice + simulated payment link), reject, send back to Head of Cargo; internal remarks; below-max discount and payment-term selection audited separately.
- `src/lib/workflow/payment.ts` (pure, all labelled simulated): facilitator pays (success / failure / stays pending), Super Admin reconciliation, 24h reminder and auto-cancel demo controls, credit-period link issue and credit settlement.
- `resubmitBooking` + `/bookings/:id/edit`: facilitator corrects a sent-back booking (reference kept).
- Booking detail page now hosts role-specific panels: Head of Cargo review, Director decision with live frozen-price preview, facilitator payment / credit panel, Super Admin demo controls, internal remarks, booking progress tracker.
- Dispatch gate verified: Pay-Now bookings reach Pending Dispatch only after payment; credit-approved bookings qualify without payment.
- 29 new tests (78 total).

## Change request applied after Phase 4 — District scoping (2026-10-13)

- Client: District Supervisor sees only their district; two districts, **Lagos** and **Ibadan**; district chosen on the facilitator registration form.
- `District` on registrations, customers, staff and personas; mandatory District field in the form (step 1, review, resubmit); second supervisor persona (Olumide Adeyemi, Ibadan); seed data spread across both districts; state version 3.
- Workflow rules reject a supervisor acting on another district; lists, dashboard and detail pages are filtered; Director / Super Admin see all.
- 4 new tests (53 total).

## Validation results (2026-10-13)

| Command | Result |
|---|---|
| `npm test` | ✅ 181/181 passed |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ passes (JS ~447 kB, 133 kB gzip) |
| Browser (dev server) | ✅ applicant resubmit → DS forward → Director approve (Priority 12% / 2 mo / ₦3M / Strategic) → customer created + audit trail; validation messages; document preview; no console errors |

## Known bugs / limitations

- Role switcher is not authentication; data is browser-local.
- Customers created by approval have no persona (cannot yet "log in" as them); bookings come in Phase 4.
- Facilitator "Re-upload" uses the browser file picker (name/size only); not automatable in my browser tests — use "Use sample file" for new docs.
- Eligibility edits for existing customers (upgrade between bookings) not built yet (Phase 7 / Director screen).
- No lint configured.

## Landing page redesign (post-Phase 8)

- Ported the approved `docs/landing-reference/landing.html` (animated aerial rail hero, runner-along-the-line stepper, receipt-style price cards, governance section, FAQ) into `src/features/landing/` (`LandingPage.tsx`, `heroScene.ts`, `landing.css`).
- Landing CSS is **scoped under `.nrc-landing`** and imported into Tailwind's `components` layer (`src/index.css`), so it cannot leak into the app and utilities still win.
- Shared public header / footer / banner (`src/components/layout/PublicChrome.tsx`) are also used by `/verify`.
- `heroScene.ts` is the reference's canvas code kept as-is (`// @ts-nocheck`, visual only) plus a small collision guard for the hero label.
- Verified at 1280 / 820 / 375 px: no horizontal overflow, Register hand-off works, FAQ / stepper / header behave.

## Navigation polish (post-Phase 8)

- Collapsible sidebar: a toggle inside the sidebar (beside the logo) collapses the sidebar to an icon-only rail (tooltips on each icon) and lets page content use the full width; the choice is remembered in localStorage (`nrc-ecargo-prototype:sidebar-collapsed`). The mobile drawer is unchanged.

- The NRC logo in the sidebar links to `/dashboard`. Prototype banners were removed from all pages.
- Director **Approve & freeze price** now asks for confirmation (total, discount, terms) before freezing.

## Next task (exact)

There is no further planned build phase. Recommended next steps:

1. **Stakeholder walkthrough** using `/demo-guide`, then record feedback.
2. **Get NRC to decide the open items** in `docs/DECISIONS.md §3` (tax basis D-1, refund policy D-2/D-3, payment window D-4, capacity D-6, documents D-7, SLAs D-9, AWB format D-10, Super Admin eligibility D-14, …). Until then every "assumption" (A-n) stays labelled as unconfirmed.
3. **Production scoping:** the prototype has no backend, authentication, Paystack, email, database-trigger auditing or real file storage — see `docs/PROTOTYPE_SPEC.md §13`. Convert confirmed rules from `src/lib/workflow/*` into server-side logic.
