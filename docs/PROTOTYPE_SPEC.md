# NRC e-Cargo — Prototype Specification

Implementation reference derived from the two source documents in `docs/`:

- **[B] Baseline** — `NRC e-Cargo Solution Flow (1).docx` — *"Final Roles & Flow"*, marked **confirmed with client**. Working baseline.
- **[O] Overview** — `NRC e-Cargo Solution Flow.docx` — *"Project Overview"*, earlier feature list. Used where [B] is silent.

Conflicts and open items: see [DECISIONS.md](DECISIONS.md). Nothing marked *assumption* is client-approved.

---

## 1. Scope

Frontend-only, interactive prototype demonstrating: facilitator onboarding, capacity-linked booking, multi-level approvals, pricing, payment governance (simulated), port validation, AWB generation, refunds (simulated), master data and audit.

**Out of scope (prototype):** backend, real auth, Paystack, email/SMS, customs/railway integrations, IP capture, DB-trigger auditing, NDPR hosting.

## 2. Roles and permissions

| # | Role | Owner | Responsibility |
|---|------|-------|----------------|
| 1 | Cargo Facilitator | Customer | Registers, books, pays, receives AWB. Sub-status **Priority / Non-Priority** (not a separate login) |
| 2 | District Supervisor | NRC | Verifies registration documents only |
| 3 | Head of Cargo | NRC | First booking approval: documents, containers, cargo, hazardous compliance |
| 4 | Director of Operations | NRC | **Business authority**: final registration & booking approval, eligibility, discount, payment terms, refund trigger |
| 5 | Head of Port Operations | NRC | Physical verification, dispatch details, AWB generation |
| 6 | Super Admin | Service provider | **Platform authority**: credentials, master data, config, reconciliation, refund execution, audit access |

**Authority separation [B §1.1, §2.3]:** Super Admin cannot approve registrations/bookings, set discount/credit/payment terms, or trigger refunds. Director cannot issue credentials, configure masters, or disburse refunds. Every Super Admin action is audit-logged.

### Access matrix [B §10]

| Action | Fac | DS | HoC | Dir | HoP | SA |
|---|---|---|---|---|---|---|
| Submit registration | ✅ | | | | | |
| Verify registration documents | | ✅ | | ✅ | | view |
| Set priority / eligible discount / credit | | | | ✅ | | "correct" ⚠ D-14 |
| Approve registration | | forward | | ✅ final | | |
| Create booking | ✅ | | | | | |
| Verify booking documents & cargo | | | ✅ | ✅ | ✅ physical | view |
| Set final discount / payment terms | | | | ✅ | | |
| Approve booking | | | forward | ✅ final | | |
| Assign wagon / train / departure; generate AWB | | | | | ✅ | |
| Trigger refund | request | | | ✅ | initiates | |
| Process refund (Paystack — simulated) | | | | | | ✅ |
| Configure masters & rates | | | | view | | ✅ |
| Reconcile payments | | | | view | | ✅ |
| Create / edit / revoke staff credentials, reset passwords | | | | | | ✅ |
| Suspend / blacklist customers | | | | ✅ | | ✅ |
| View activity | own | own queue | own queue | full | own queue | full |

### Facilitator sub-types [B §1.2]

| | Priority | Non-Priority |
|---|---|---|
| Discount | Up to assigned maximum | None |
| Credit | Up to assigned period (months) | None |
| Payment options | Pay Now, or Pay After Credit Period | Pay Now only |
| Price breakdown | With discount line | No discount line |

## 3. Registration workflow [B §3, O]

```
Facilitator submits → District Supervisor verifies → Director sets eligibility & approves → credentials generated (simulated email)
```

**Form (mandatory):** Company Name · Registered Address · CAC Number · Mode of Operations (Containerized / Non-Containerized, multi) · Services (Clearance / Loading-Offloading / Documentation / Multi-modal) · POC Name · POC Email · Country Code + POC phone.
**Documents:** CAC Certificate (mandatory) · Company Profile (mandatory) · Tax Certificate (optional, configurable). View uploaded docs; re-upload before submission (and after send-back — assumption A-7).

**District Supervisor:** dashboard Pending / Approved / Rejected counts; view/download application; timeline; phone with country code; internal remarks.
Automated checks: **duplicate CAC**, **blacklisted customer**, **incomplete documentation**.
Decision: discrepancy → **send back to facilitator** (mandatory remarks, email simulated); verified → **forward to Director**. Does **not** decide priority, discount, credit, category.

**Director:** dashboard *Registrations Pending Final Approval*. Sets permanent profile:
Priority/Non-Priority · Eligible Discount % · Eligible Credit Period (months) · Credit Threshold (max outstanding) · Category (Bulk / SME / Strategic / Government).
Actions: Approve · Reject · Send back to District Supervisor · Remarks.
On approval: username, temporary password (forced change — simulated), customer status, credit terms, discount policy. Emails to customer + DS (simulated).

**Statuses:** `pending_district_verification` → `pending_director_approval` → `activated`; branches `sent_back_to_facilitator`, `sent_back_to_district`, `rejected`.
**Timeline:** Submitted → District Verification → Director Approval → Activated.

## 4. Booking workflow [B §4]

```
Facilitator creates & accepts terms (NO PAYMENT) → Head of Cargo verifies → Director approves, sets discount & terms
→ price frozen, invoice, payment link (simulated) → paid / credit period begins → Head of Port physical check & dispatch → AWB
```

**Facilitator dashboard:** Total Bookings · Pending Approval · AWB Generated · list with live status.
**Form:** Booking Date* · Cargo Type* · Route* (from Route & Freight Rate Master) · Bill of Lading* · Containers/Wagons* (multiple container types per booking — A-4) · Weight (t)* · Hazardous (Yes → compliance doc mandatory) · Special Handling · Remarks. Commodity type [O].
Documents [O, open D-7]: Bill of Lading, Packing List, Invoice; Radiation Certificate (if required); Customs Clearance (if applicable). Submission blocked without mandatory documents.
Live indicative price breakdown. Mandatory declaration: *"I confirm compliance with NRC Fair Cargo Policy."* Preview → confirm → submit. On submit: status **Pending Head of Cargo Review**, notification (simulated).
Capacity/slot validation [O]: open item D-6.

**Head of Cargo:** dashboard *Pending Booking Approvals*. Review: company, date, cargo type, route, containers/wagons, weight, hazardous flag, full pricing summary, documents. Verifies completeness, container/wagon details, weight & declaration, hazardous docs. Actions: remarks · reject · send back to facilitator · approve → Director. Does **not** set discount or payment terms.

**Director:** dashboard *Bookings Awaiting Final Approval* (ID, company, route, amount). Review: company, priority status, route, total, eligible credit period & discount.
Sets: Final Discount (priority: downward only, ≤ eligible max; non-priority: unavailable) · Payment Terms (priority: Pay Now / Pay After Credit; non-priority: Pay Now only) · Credit Period (≤ eligible max, if pay-later) · Remarks.
Actions: Reject · Send back to Head of Cargo [B §9] · Approve.
On approval: final price recalculated & **frozen**; invoice; payment link (simulated); status **Awaiting Payment** or **Credit Approved**. Reduction below max logged with actor, timestamp, reason.

**Head of Port Operations:** dashboard *Bookings Awaiting Dispatch* · *AWB Generated*. Views booking, documents, timeline, payment status, date, cargo.
Physical verification: container/wagon count vs declaration · cargo type & weight · condition/suitability · hazardous handling.
Dispatch fields: Wagon No.* · Train No.* · Departure Date* · Departure Time* · Loading Yard · Remarks.
Fail → cancel & report to Director with mandatory reason → `rejected_physical`, capacity released, refund flow if paid. Pass → **Approve Dispatch & Generate AWB**.

**Booking statuses [B §8]:** Draft → Pending HoC Review → Pending Director Review → Awaiting Payment | Credit Approved → Pending Dispatch → AWB Generated → Completed.
Alternative endings: Rejected (HoC / Director, no refund) · Rejected — Physical Verification Failed (refund if paid) · Auto-Cancelled (unpaid after window).

**Send-back rules [B §9]** (all require mandatory remarks + simulated email):

| From | To |
|---|---|
| DS (registration) | Facilitator |
| Director (registration) | District Supervisor |
| HoC (booking) | Facilitator |
| Director (booking) | Head of Cargo |
| Head of Port | Director (refund flow if paid) |

## 5. Pricing [B §7]

```
Base Freight = Σ rate(route, cargo type, container type) × quantity
Discount     = Base Freight × approved discount %      (priority only)
Net Freight  = Base Freight − Discount
VAT 7.5% · Stamp Duty 0.75% · Goods-in-Transit Insurance 1.5%   — on Net Freight (basis UNRESOLVED, D-1)
Total        = Net Freight + VAT + Stamp Duty + Insurance
```

- Indicative price at creation uses the customer's **eligible** discount; shown as indicative (Director may reduce).
- Final price calculated **once** at Director approval and frozen.
- Rates are **effective-dated**, insert-only.
- Amounts stored as **integer kobo**, displayed to 2 dp.
- Missing rate for route × cargo type × container type **blocks** booking creation. Never price at ₦0.

Reference examples (must reproduce exactly): base ₦180,000 · priority 10% → **₦177,795**; non-priority → **₦197,550**.

## 6. Discounts & eligibility [B §6]

- Entitlement set at **customer level**; never invented at booking level.
- Priority 10% eligible → Director may grant 10/8/5/0%, never 12%. Non-priority → field unavailable.
- Director may upgrade a customer between bookings; change applies to **next** booking only. Approved bookings keep frozen terms (eligibility snapshot stored).
- Every change logged old → new, actor, timestamp, reason.

## 7. Payment & credit [B §4.4, O]

| Terms | Behaviour |
|---|---|
| Pay Now | Link issued; **Awaiting Payment**; reminder after 24h; auto-cancel after configured window (proposed 72h), capacity released |
| Pay After Credit | Proceeds without payment; link issued at end of credit period; outstanding balance vs credit threshold — exceeded → further bookings blocked |

- Payment only **after** Director approval.
- A Pay-Now booking never reaches Head of Port until paid.
- Production: confirmation only via verified webhook/server verification; unmatched → Super Admin exception queue. **Prototype: all outcomes simulated and labelled; Paystack never contacted.**
- Hybrid (partial advance + credit) [O Scenario C]: not in baseline — D-8.

## 8. AWB [B §4.6]

Contents: unique AWB no. · QR · booking ref · route · containers · customer · payment status · train no. · wagon no. · departure date/time · generation timestamp.
Distributed to customer, HoC, Director, HoP (simulated). Facilitator sees **AWB Generated** with **View AWB**.
Rules: **idempotent** (retry returns the existing AWB) · never reused/edited; amendment → new version, prior marked superseded · QR encodes verification URL (prototype: clearly-labelled demo reference, not signed).
Number format proposal (D-10): `NRC-AWB-YY-NNNNNN-C` (Luhn check digit).

## 9. Refunds [B §5]

```
HoP rejects (reason) → Director triggers refund link → Facilitator submits request (bank details — simulated, never real)
→ Super Admin verifies & processes (simulated Paystack) → Requested → Under Review → Approved → Processed
```

Separation of duties: Director triggers, Super Admin executes. Incorrect refund → reversing entry; never edit/delete. Also triggered by: customer cancellation before dispatch, duplicate payment, auto-cancel after payment in error. Full vs partial & refund window unresolved (D-2, D-3).

## 10. Super Admin [B §2]

Credentials: create DS/HoC/Director/HoP accounts, initial credentials + forced change, reset, edit, suspend/revoke, reassign role (all simulated).
Platform: master data (routes, freight rates, tax/levy rates, train schedules, container types, commodity types, discount matrix, payment threshold matrix); config (email templates, notification rules, gateway settings, document requirements); customer maintenance (suspend, blacklist, correct records); refund processing; reconciliation & exceptions; audit access; reports/export.

## 11. Master data [O, B]

Customer · Route & Freight Rate (effective-dated) · Train Schedule · Container Type · Commodity Type · Discount Matrix · Payment Threshold Matrix · Tax & Levy rates · Policy Compliance Log. Sample routes: Apapa Port → Apapa Local / Ebute Metta / Moniya.

## 12. Audit & timelines [B §11]

Each entry: actor, role, timestamp, action, previous → new status, remarks; old → new value for config/eligibility. (IP address: not captured in prototype.)
Specifically audited: discount below max (with reason), eligibility changes, payment-term selection, all rejections, physical-verification failures, refund triggers/disbursements, all Super Admin credential actions, all master-data changes.
**Prototype audit is browser-local demo data, not tamper-proof.**

## 13. Prototype-only simulations

Role switcher (no login) · document uploads (filename/size only) · emails/notifications · credential generation · payment link/success/failure/pending/reconciliation · credit-period expiry · auto-cancel timer (manual trigger) · refund processing · AWB QR (demo reference) · localStorage persistence (per browser).

## 14. Acceptance criteria (prototype)

1. Each of the six roles sees only its navigation and permitted actions; Super Admin cannot approve or grant business benefits.
2. Registration: submit → DS send-back with remarks → resubmit → DS forward → Director sets eligibility & approves → customer active; duplicate/blacklist/incomplete checks visible.
3. Booking: indicative price matches §5 examples; missing rate blocks submission; mandatory docs & declaration enforced; hazardous requires compliance doc.
4. HoC approve/reject/send-back; Director approve with discount ≤ eligibility (none for non-priority), reason required below max, price frozen.
5. Payment simulation: success, failure, pending, auto-cancel; credit path; threshold block.
6. Pay-Now booking cannot reach dispatch until paid.
7. HoP physical fail → Director → refund trigger → facilitator request → Super Admin process.
8. Dispatch requires wagon, train, date, time; AWB generated once (retry returns same number); viewable from booking.
9. Eligibility change does not alter approved bookings.
10. Every transition appears in the booking/registration timeline and audit log.
11. State persists across refresh; "Reset demo" restores seed data.
12. Deep links work on Render (SPA rewrite).

## 15. Unresolved decisions

See [DECISIONS.md §3](DECISIONS.md#3-unresolved-business-rules-require-nrc-confirmation).
