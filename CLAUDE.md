# NRC e-Cargo — Prototype

Frontend-only, interactive stakeholder prototype of the NRC e-Cargo Operations Platform (registration, booking, approvals, pricing, simulated payment, dispatch, AWB, refunds, admin, audit). **Not** the production system. Unrelated to E-Parking — never mix code.

- Spec (canonical): [docs/PROTOTYPE_SPEC.md](docs/PROTOTYPE_SPEC.md) · Decisions/conflicts: [docs/DECISIONS.md](docs/DECISIONS.md) · Progress: [docs/PROGRESS.md](docs/PROGRESS.md) · Deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Source requirement docs (.docx) live in `docs/`. Read the spec first; consult originals only for specific sections.

## Stack

React 19 · TypeScript 7 (strict) · Vite 8 · Tailwind CSS 4 (`@tailwindcss/vite`) · React Router 8 (`react-router`) · lucide-react · Vitest. UI primitives are hand-written shadcn-style components in `src/components/ui`. Persistence: localStorage.

## Structure

```
src/
  app/          store (context + reducer + localStorage), navigation, selectors
  components/   ui/ primitives & blocks, layout/ shell + role switcher
  features/     one folder per area (dashboard, bookings, registrations, customers, audit, master-data, placeholder)
  lib/          pure business rules: pricing, eligibility, status/dispatch gate, permissions, registration checks, awb, money, capacity (simulated), sla (ageing), csv
  lib/workflow/ pure state transitions per area (registration, booking, bookingApproval, payment, dispatch, refund, staff, masterData, customerAdmin, paymentException)
  data/         seed.ts (demo data), personas.ts (role switcher)
  types/        domain.ts
```

## Commands

```
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — business-rule tests (src/**/*.test.ts)
npm run typecheck  # tsc -b
npm run build      # tsc -b && vite build → dist/
```

## Critical rules (keep in `src/lib`, never in components)

- Money in integer kobo; percentages in basis points. Pricing throws on missing rate — never returns ₦0.
- Discount ≤ customer's eligible max; none for Non-Priority. Below-max requires reason.
- Final price frozen at Director approval with eligibility snapshot; eligibility changes never retroactive.
- Payment only after Director approval. Pay-Now bookings cannot reach dispatch until paid.
- AWB generation idempotent. Super Admin has no business approval authority.
- Every transition writes an audit entry (actor, role, time, from→to, remarks).
- Label every simulated payment/email/refund as simulated. Never claim Paystack was contacted.

## Working rules

- Preserve scope: one phase at a time per `docs/PROGRESS.md`. Don't present unresolved decisions as confirmed — add to DECISIONS.md.
- Avoid new dependencies unless clearly justified. No backend/DB/Docker.
- After each phase: `npm test`, `npm run build`, update `docs/PROGRESS.md`. Never commit, push or deploy unless asked.
- Workflow functions live in `src/lib/workflow/` (pure; take AppData, return new AppData or error) and are invoked via `useStore().act(...)`. Every success writes an audit entry; `journey.test.ts` checks audit-trail invariants — keep it green.
- Public pages (`/`, `/verify`) sit outside `AppShell` and use the scoped `.nrc-landing` styles (`features/landing/landing.css`, design reference in `docs/landing-reference/`); list pages for refunds / payment exceptions are cards that link to detail pages where actions happen.
- Bump `SEED_VERSION` in `src/data/seed.ts` when the persisted state shape changes (forces a reseed).
