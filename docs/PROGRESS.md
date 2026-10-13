# Progress

## Current phase

**Phase 4 (Booking creation & pricing) complete** (2026-10-13). Phases 1–3 pushed.

| Phase | Scope | Status |
|---|---|---|
| 1 | Requirements review, project setup, docs | ✅ Done |
| 2 | UI system, shell, navigation, role switcher, seeded dashboards | ✅ Foundation done |
| 3 | Registration workflow | ✅ Done |
| 4 | Booking creation & pricing | ✅ Done |
| 5 | Booking approvals & payment simulation | ⏭ Next |
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

## Phase 4 — completed

- `src/lib/workflow/booking.ts` (pure): `validateBooking`, `bookingBlock` (suspended / blacklisted / credit threshold), `indicativePrice`, `createBooking` (status Pending Head of Cargo Review, no payment, audit entry, reference NRC-BK-2026-NNNN).
- `/bookings/new`: 3-step form (shipment → documents → review & declaration) with live indicative price; multiple container lines; hazardous → compliance document; blocked when no rate exists (e.g. Moniya non-containerized).
- Shared `PriceBreakdown` (all components, rates and assumptions visible; no discount line for Non-Priority; "Frozen" mode ready for Phase 5).
- `/bookings/:id` read-only detail: booking progress tracker, details, documents, price, payment & credit, timeline. Booking references link to it.
- Generic `StageTracker` (registration + booking trackers).
- 15 new tests (49 total).

## Change request applied after Phase 4 — District scoping (2026-10-13)

- Client: District Supervisor sees only their district; two districts, **Lagos** and **Ibadan**; district chosen on the facilitator registration form.
- `District` on registrations, customers, staff and personas; mandatory District field in the form (step 1, review, resubmit); second supervisor persona (Olumide Adeyemi, Ibadan); seed data spread across both districts; state version 3.
- Workflow rules reject a supervisor acting on another district; lists, dashboard and detail pages are filtered; Director / Super Admin see all.
- 4 new tests (53 total).

## Validation results (2026-10-13)

| Command | Result |
|---|---|
| `npm test` | ✅ 53/53 passed |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ passes (JS ~447 kB, 133 kB gzip) |
| Browser (dev server) | ✅ applicant resubmit → DS forward → Director approve (Priority 12% / 2 mo / ₦3M / Strategic) → customer created + audit trail; validation messages; document preview; no console errors |

## Known bugs / limitations

- Role switcher is not authentication; data is browser-local.
- Customers created by approval have no persona (cannot yet "log in" as them); bookings come in Phase 4.
- Facilitator "Re-upload" uses the browser file picker (name/size only); not automatable in my browser tests — use "Use sample file" for new docs.
- Eligibility edits for existing customers (upgrade between bookings) not built yet (Phase 7 / Director screen).
- No lint configured.

## Next task (exact)

**Phase 5 — Booking approvals & payment simulation:**
1. `src/lib/workflow/bookingApproval.ts` (pure): Head of Cargo approve / reject / send back to facilitator (remarks); Director approve (final discount ≤ eligible, none for Non-Priority, reason when below max; payment terms; credit months ≤ eligible), reject, send back to Head of Cargo; price recalculated and frozen with eligibility snapshot; status Awaiting Payment or Credit Approved; invoice + simulated payment link.
2. Facilitator resubmission after send-back (edit booking).
3. Payment simulation panel (clearly labelled simulated): success, failure, pending, reconciliation; 24h reminder and auto-cancel (manual trigger); credit period end → link; credit threshold block.
4. Booking detail action panels per role; HoC/Director review screens.
5. Tests for every transition, discount/credit rules and the dispatch gate; update PROGRESS.md.
