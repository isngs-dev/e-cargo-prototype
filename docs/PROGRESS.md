# Progress

## Current phase

**Phase 5 (Booking approvals & payment simulation) complete** (2026-10-13).

| Phase | Scope | Status |
|---|---|---|
| 1 | Requirements review, project setup, docs | ✅ Done |
| 2 | UI system, shell, navigation, role switcher, seeded dashboards | ✅ Foundation done |
| 3 | Registration workflow | ✅ Done |
| 4 | Booking creation & pricing | ✅ Done |
| 5 | Booking approvals & payment simulation | ✅ Done |
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
| `npm test` | ✅ 78/78 passed |
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

**Phase 6 — Port operations, AWB generation and refunds:**
1. `src/lib/workflow/dispatch.ts` (pure): Head of Port physical verification checklist; dispatch details (wagon, train, departure date/time mandatory; loading yard, remarks); fail → reject with mandatory reason, status `rejected_physical`, capacity released, refund record created when paid; pass → approve dispatch and generate AWB.
2. AWB: stable unique number (`formatAwbNumber`), **idempotent** (repeat returns the existing AWB, never a second number), versioning/superseded, QR preview only if a suitable library is justified (otherwise a clearly labelled demo reference), view from the booking and `/awbs` register.
3. Dispatch queue `/dispatch` and dispatch panel on the booking detail page; dispatch gate enforced in the workflow (payment or credit condition).
4. Refund flow: Director triggers the refund link; facilitator submits request (simulated bank details, never real); Super Admin processes — Requested → Under Review → Approved → Processed; `/refunds` screen per role.
5. Tests for the gate, idempotent AWB, failure → refund, refund state machine; update PROGRESS.md.
