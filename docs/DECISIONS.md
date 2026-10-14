# Decision Log

**[B]** = `NRC e-Cargo Solution Flow (1).docx` (Final Roles & Flow — confirmed baseline). **[O]** = `NRC e-Cargo Solution Flow.docx` (Project Overview).

## 1. Confirmed decisions (from [B])

| # | Decision |
|---|---|
| C-1 | Six roles; DS (registration) and HoC (booking) are separate roles |
| C-2 | Director = business authority; Super Admin = platform authority; neither performs the other's function |
| C-3 | Priority/Non-Priority is a customer status, not a login |
| C-4 | Single-pass approval; payment only after Director approval |
| C-5 | Discount set downward-only within customer eligibility; none for non-priority |
| C-6 | Final price frozen at Director approval; eligibility changes never retroactive |
| C-7 | Pricing order, VAT 7.5%, Stamp Duty 0.75%, Insurance 1.5%; integer kobo; missing rate blocks booking |
| C-8 | Pay-Now bookings do not reach Head of Port until paid |
| C-9 | AWB generation idempotent; versions supersede, never edited |
| C-10 | Refund: Director triggers, Super Admin executes |
| C-11 | Payment gateway: Paystack (simulated only in prototype) |

## 2. Conflicts between [O] and [B] — resolved in favour of [B]

| # | [O] says | [B] says | Prototype |
|---|---|---|---|
| X-1 | Combined "District Supervisor / Head of Cargo" role reviewing registrations and bookings | Separate DS (registration) and HoC (booking) | [B] |
| X-2 | DS/HoC registration review can mark Priority, assign discount/credit/category | DS does not decide eligibility; Director does | [B] |
| X-3 | HoC booking review can modify booking, apply/override discount, select payment mode; RBAC "Override Payment: Partial" | HoC does not set discount or payment terms | [B] |
| X-4 | Director can "Override Discount" | Downward only, capped at eligibility | [B] |
| X-5 | Head of Port discrepancy → send back to Head of Cargo | Cancel & report to Director; refund flow if paid | [B] |
| X-6 | "Finance/Admin" role | Super Admin (service provider), incl. refund processing | [B] |
| X-7 | Registration timeline: Submitted → Review → HQ Approval → Activated | Submitted → District Verification → Director Approval → Activated | [B] |
| X-8 | Booking timeline has generic "Payment"/"Port Validation" | Explicit statuses incl. Awaiting Payment / Credit Approved / Pending Dispatch | [B] |
| X-9 | Admin panel edits priority status, credit days, discount structures | §2.3: Super Admin cannot set discounts/credit | [B §2.3]; see D-14 |
| X-11 | District Supervisor role is not scoped by district | **Client update 2026-10-13:** DS only sees applications of their own district (Lagos or Ibadan); facilitator selects the district on the registration form | Implemented |
| X-10 | Registration emails to Customer + DS/HoC | Customer + DS | [B] |

## 3. Unresolved business rules (require NRC confirmation)

Items 1–11 are [B §12] open items. Values shown are **proposals**, not approvals.

| # | Item | Proposal / prototype default |
|---|---|---|
| D-1 | Tax basis — VAT/Stamp/Insurance on net or gross freight | Net (configurable `config.tax.basis`) |
| D-2 | Refund on physical failure — full, or cancellation charge? | Full refund shown; partial not modelled |
| D-3 | Refund request window | 30 days (display only) |
| D-4 | Payment window before auto-cancel | 72 hours; reminder 24h |
| D-5 | Non-containerized rate coverage (₦0 booking previously passed approvals) | Rate required per route × cargo type; APP-MNY non-cont. intentionally has no rate to demo blocking |
| D-6 | Capacity validation at booking (train slots, route capacity, maintenance, waitlist [O]) | Not yet designed; Phase 4 to show clearly-simulated availability only if confirmed useful |
| D-7 | Document set — full five or Bill of Lading only | BoL, Packing List, Invoice mandatory; Radiation & Customs conditional |
| D-8 | Multiple container types per booking; hybrid payment (partial advance + credit) [O Scenario C] | Multiple lines supported; hybrid **not** implemented |
| D-9 | Approval SLAs / ageing / escalation | Not implemented; no auto-approval |
| D-10 | AWB numbering format | `NRC-AWB-YY-NNNNNN-C` (Luhn) — proposal |
| D-11 | Hosting & NDPR residency | N/A for prototype |
| D-12 | Who can reject a registration? [B §3.2] gives DS only send-back/forward, yet DS dashboard shows "Rejected" | Only Director rejects; DS dashboard counts all rejections |
| D-13 | Customer cancellation before dispatch (refund trigger [B §5.3]) — flow not specified | Not designed yet |
| D-14 | Access matrix gives Super Admin "✅ correct" on priority/discount/credit, but §2.3 forbids it | Super Admin **cannot** change eligibility in prototype; record-correction scope to be confirmed |
| D-15 | Credit-period payment link: who/what triggers at period end; settlement of credit | Simulated manual "credit period ended" action |
| D-16 | Non-containerized pricing unit (per wagon vs per ton) | Per wagon (formula says × quantity of containers/wagons) |
| D-18 | Do bookings, dispatch or Head of Cargo / Port roles also need district scoping? Not specified — currently national | Not scoped |
| D-17 | Public landing page, FAQ, live train widget [O] | Not in baseline; optional Phase 8 |

## 4. Demonstration assumptions

| # | Assumption |
|---|---|
| A-1 | "Submitted" is a timeline event; the resulting status is Pending Head of Cargo Review |
| A-2 | Credit Approved bookings are eligible for dispatch without passing through a separate Pending Dispatch step |
| A-3 | Freight rates and amounts are illustrative demo values, not NRC tariffs |
| A-4 | A booking may contain several container lines (20ft, 40ft, Reefer); non-containerized uses Wagon lines |
| A-5 | Rounding: each percentage component rounded half-up to the nearest kobo independently |
| A-6 | Head of Cargo and Head of Port see all bookings relevant to their stage (not filtered by district) |
| A-7 | Facilitator may re-upload documents after a send-back, not only before submission |
| A-8 | Audit IP address not captured; audit log stored in localStorage and not tamper-proof |
| A-10 | CAC number format validated as RC / BN / IT + 4–8 digits (format not specified in either document) |
| A-11 | District Supervisor cannot forward an application with incomplete documents; duplicate-CAC / blacklist flags may be forwarded only with explanatory remarks (documents say checks exist, not what they block) |
| A-12 | Internal remarks are visible to DS/Director only and hidden from the facilitator timeline; send-back remarks are visible to the facilitator |
| A-13 | Director's eligibility on approval: Non-Priority forces discount/credit/threshold to zero; Priority requires a threshold when credit months > 0; discount 0–100% (no NRC ceiling stated) |
| A-14 | Temporary passwords are never generated or displayed; credential issuance is shown as a simulated email |
| A-15 | A demo "applicant" persona represents a not-yet-registered public applicant; customers created by approval have no persona in the role switcher |
| A-16 | Booking mandatory documents: Bill of Lading, Packing List, Invoice (+ hazardous compliance if hazardous). Radiation Certificate and Customs Clearance are optional uploads (D-7) |
| A-17 | Booking date cannot be in the past; no lead-time or capacity rule applied (D-6) |
| A-18 | Same container type may appear once per booking; containerized = 20ft/40ft/Reefer lines, non-containerized = Wagon only |
| A-19 | Booking creation is blocked for suspended/blacklisted customers and when outstanding credit exceeds the threshold; no mode-of-operation restriction is enforced against the company's registered modes |
| A-20 | Drafts are not modelled; the form submits straight to Pending Head of Cargo Review. Commodity is free text with suggestions (Commodity Master not built) |
| A-21 | Districts are exactly Lagos and Ibadan (client). Exactly one District Supervisor persona per district in the demo; Head of Cargo / Port / Director remain national |
| A-22 | District is chosen by the facilitator and cannot be changed by the District Supervisor; if a facilitator picks the wrong district the supervisor sends it back (no inter-district transfer built) — to confirm with NRC |
| A-23 | Seed districts are demo assignments (e.g. Ogun Valley and Benin-Ore placed under Ibadan) |
| A-24 | Credit approval is blocked when outstanding credit plus the booking total would exceed the customer's credit threshold ("maximum outstanding balance permitted"); the Director can choose Payment Link Now instead |
| A-25 | Invoice number = `INV-2026-` + the booking number; simulated payment reference = `DEMO-PSK-` + the booking number. Neither is an NRC or Paystack format |
| A-26 | Payment simulation: the facilitator picks the outcome (success / failure / stays pending). "Stays pending" is reconciled by Super Admin (simulated webhook). 24h reminder, payment-window auto-cancel and credit-period end are Super Admin demo buttons because there is no clock/back-end |
| A-27 | A failed simulated payment keeps the booking Awaiting Payment and the link usable until the window elapses; the facilitator may retry |
| A-28 | Credit bookings that reach dispatch are not blocked by the credit-period payment link; settlement is separate. What happens if credit is never settled is not specified (D-15) |
| A-29 | Head of Cargo / Director rejection before payment sets payment to "Cancelled" (no refund path needed) |
| A-30 | Dispatch: wagon, train, departure date (not in the past) and time (HH:MM) are mandatory; all physical-verification items must be confirmed (hazardous handling only when the cargo is hazardous) |
| A-31 | AWB number is generated from a counter at dispatch approval; repeating the action returns the existing AWB and consumes no number. AWB amendment / versioning (new version, prior superseded) is not built — every AWB is version 1 |
| A-32 | The AWB QR encodes a clearly labelled demo reference (`DEMO-VERIFY://…`), not a signed verification URL; the `qrcode.react` library is used for the preview only |
| A-33 | A failed physical check on a booking with money received (paid, or credit already settled) creates a refund for the full approved total (D-2 unresolved); unpaid credit is cancelled with no refund and stops counting against the credit threshold |
| A-34 | Refund request: bank name, account name, 10-digit account number (only last 4 kept), confirmed amount equal to the refund amount, policy acknowledged; refund window is 30 days from the link being sent (D-3 unresolved) |
| A-35 | Reversal entries and refunds triggered by customer cancellation / duplicate payment are not built (D-13); Head of Port marks a booking Completed (delivery) — who closes bookings is not specified |
| A-9 | Seed date context is October 2026; seeded timestamps are fixed |
