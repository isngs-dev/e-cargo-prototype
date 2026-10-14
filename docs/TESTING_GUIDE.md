# Full manual testing guide

Live site: https://nrc-ecargo-prototype.onrender.com (or `npm run dev` → http://localhost:5173)

**How to use:** switch roles with the dropdown at the top right. Click **Reset demo** (top bar) before each Part so the data matches. Everything is simulated; data lives only in your browser. Tick each ✅ line.

Roles: Adaeze Okafor (Priority facilitator) · Ibrahim Musa (Non-Priority facilitator) · Obinna Chukwu (new applicant) · Chukwuemeka Obi (DS Lagos) · Olumide Adeyemi (DS Ibadan) · Funmilayo Adebayo (Head of Cargo) · Aliyu Bello (Director) · Grace Etim (Head of Port) · Tunde Bakare (Super Admin).

---

## Part 0 — Landing page and public pages

1. Open the site root `/`. ✅ Animated hero, no "Prototype" banner at the top.
2. Scroll: Services, How it works, Train availability, FAQ. ✅ Header turns solid after the hero.
3. Click **Verify an AWB** → type `NRC-AWB-26-000000-0`. ✅ "Not found / invalid" message, no crash.
4. Click **Open the platform**. ✅ Lands on the dashboard.
5. Click the NRC logo (top left of the sidebar). ✅ Goes to the dashboard. Click the collapse icon beside it. ✅ Sidebar shrinks to icons; refresh the page and it stays collapsed. Expand again.

## Part 1 — Facilitator registration (new customer)

1. Reset demo. Role: **Obinna Chukwu**. Open **Register** in the sidebar.
2. Click **Next** with the form empty. ✅ Red messages for every required field, including **District**.
3. Click **Fill demo data**, choose district **Lagos**, then Next.
4. Click Next without documents. ✅ Blocked: CAC Certificate and Company Profile are mandatory.
5. Add both with **Use sample file**. Next → review page shows District. Submit.
   ✅ Status **Pending District Verification**, a reference number, and a timeline.
6. Switch to **Olumide Adeyemi (Ibadan DS)** → Registrations. ✅ Your Lagos application is NOT visible.
7. Switch to **Chukwuemeka Obi (Lagos DS)** → open it. ✅ Automated checks shown (duplicate CAC, blacklist, documents).
8. Click Send back with no remarks. ✅ Refused (remarks mandatory). Send back with "CAC document unclear". ✅ Status **Sent Back to Facilitator**.
9. Switch to Obinna → **My registration** → correct and resubmit. ✅ Back to Pending District Verification.
10. As Chukwuemeka: **Verified — forward to Director**. ✅ Pending Director Approval.
11. As **Aliyu Bello (Director)**: open it. Choose Priority, discount 10, credit 2 months, threshold 5000000, category Strategic → **Approve & activate**.
    ✅ Status Activated, a customer record appears under **Customers**, simulated email shown. Try Non-Priority: ✅ discount and credit forced to zero.
12. Open the Audit log. ✅ Every step above is listed with actor, role, time and from → to.

**Special cases:** open the seeded registrations as the DS. ✅ "Swift Delta Movers" (CAC RC 2776120) and "Coastline Cargo Partners" (RC 2210984) show a **duplicate CAC** flag; a blacklisted/incomplete one shows its own flag. Forwarding a flagged one requires remarks. The Director can also **Reject** and **Send back to District Supervisor** (remarks mandatory).

## Part 2 — Booking, pricing and approvals (Priority customer)

1. Reset demo. Role: **Adaeze Okafor** → **New booking**.
2. Route Apapa → Ebute Metta, 2 × 20ft, weight 38, future date. ✅ Live price shows a **discount line** (indicative).
3. Mark cargo **Hazardous**. ✅ Compliance document becomes mandatory. Untick.
4. Try to continue without Bill of Lading / Packing List / Invoice. ✅ Blocked.
5. Preview → tick "I confirm compliance with NRC Fair Cargo Policy" → Submit. ✅ **Pending Head of Cargo Review**, no payment asked.
6. Role **Funmilayo Adebayo (Head of Cargo)** → open the booking. ✅ No discount or payment fields. Click **Send back** with no comment (refused), then with a comment. ✅ Sent Back to Facilitator.
7. As Adaeze: **Correct & resubmit** → submit. ✅ Same reference, back to HoC review.
8. As Funmilayo: **Verified — forward to Director**. ✅ Pending Director Review.
9. As **Aliyu Bello**: open it. Enter discount **12**. ✅ Refused (max 10). Enter **8** with no reason. ✅ Refused (reason mandatory). Add a reason, terms **Payment link now** → **Approve & freeze price**. ✅ A confirmation dialog shows the total, discount and terms; **Cancel** changes nothing. Click **Approve & freeze**.
   ✅ **Awaiting Payment**, price frozen, invoice and simulated payment link, discount-below-max in the audit log.
10. Try the Director's **Reject** and **Send back to Head of Cargo** on another pending booking (remarks mandatory).

## Part 3 — Payment (simulated)

1. As Adaeze, open the Awaiting Payment booking. ✅ Clearly labelled **simulated**.
2. Click **Payment fails**. ✅ Stays Awaiting Payment, retry allowed. Click **Pay successfully**. ✅ **Pending Dispatch**.
3. Seeded unpaid booking: as **Tunde Bakare (Super Admin)** → find the Awaiting Payment booking with a *pending* payment → reconcile. ✅ Becomes paid.
4. Super Admin demo controls: **24h reminder** (✅ audit entry) and **auto-cancel** (✅ status Auto-Cancelled, capacity released).
5. Credit path: Director approves with **Pay after credit period** (months ≤ 2). ✅ **Credit Approved**, no payment needed, can be dispatched.
   Try a credit larger than the customer's maximum or beyond the threshold. ✅ Refused.

## Part 4 — Non-Priority customer and pricing rules

1. Role **Ibrahim Musa** → New booking → Ebute Metta, 2 × 20ft, next month. ✅ **No discount line**, total **₦197,550.00**.
2. Switch to Non-Containerized, route Moniya. ✅ "No rate configured" — cannot continue (never ₦0).
3. Route Ebute Metta, date **30 Oct 2026**. ✅ "No slots" (maintenance block) and a **Join waitlist** button. Join it. ✅ Not a booking; leave it again.
4. As Director on a Non-Priority booking: ✅ discount field unavailable, only Pay Now.

## Part 5 — Dispatch, AWB, verification

1. Role **Grace Etim (Head of Port)** → **Dispatch** queue → open the Pending Dispatch booking.
2. Try to submit empty. ✅ Wagon, train, date, time and the checklist are mandatory.
3. Fill everything → **Approve dispatch & generate AWB**. ✅ **AWB Generated**, an AWB number.
4. Click the button again / refresh. ✅ Same AWB number, no new one (idempotent).
5. As Adaeze → booking → **View AWB**. ✅ QR code, version 1, "demonstration" label, print works.
6. Scan or open the QR link (or `/verify` and type the number). ✅ **Valid**.
7. As Grace → **Amend AWB** with a reason. ✅ Same number, now **v2**; verify page shows v1 as **superseded**.
8. **AWB register** (`/awbs`) lists all of them.
9. Pay-Now gate: find a Pay-Now booking still Awaiting Payment (e.g. the pending one). ✅ It is not in Grace's dispatch queue and cannot be dispatched.
10. As Grace on a Pending Dispatch booking, use **Mark complete** after AWB. ✅ Completed.

## Part 6 — Failure, refund and reversal

1. As Grace: open a paid Pending Dispatch booking → **Physical verification failed** with no reason (refused) then with a reason.
   ✅ **Rejected — Physical Verification Failed**, capacity released, a **refund** created awaiting the Director.
2. Role Aliyu → **Refunds** (cards) → open it → **Trigger refund**. ✅ Link sent (simulated).
3. As Adaeze → **Refunds** → open → submit bank details (10-digit account, confirm the amount, tick the policy). ✅ Only the last 4 digits are kept.
4. As Tunde → Refunds → open → **Start review → Approve → Process** (cannot skip). ✅ Processed (simulated Paystack).
5. As Tunde: **Reverse** the processed refund with a reason. ✅ A separate reversing entry; original unchanged; only once.
6. Separation of duties: ✅ the Director cannot process a refund; Super Admin cannot trigger one.

## Part 7 — Super Admin and customers

1. Role Tunde: **Staff accounts** → create a user, edit, reset password, suspend, reactivate, reassign role/district, revoke (permanent). ✅ Reasons required, audit entries, no real passwords shown.
2. **Routes & rates** → add a rate effective today or later. ✅ Never edits history; old rows stay. Change a tax setting. ✅ One audit entry per change. Existing frozen prices don't change.
3. **Payments** (exceptions) → open one → match to an invoice / start a duplicate-payment refund / return.
4. **Capacity** → add a maintenance block on a route/date. ✅ The landing availability and the booking form reflect it.
5. **Customers** → open one: Director can change eligibility ✅ (not retroactive); Super Admin can only correct address/contact ✅ and cannot change discount/credit. Suspend / blacklist (reason required). ✅ A suspended customer cannot create bookings.
6. **Audit log**: filter by role/date/entity, **Export CSV**. ✅ File downloads.
7. Super Admin on a booking: ✅ no Approve buttons at all.

## Part 8 — Access control and polish

1. As each of the 9 personas, look at the sidebar. ✅ Only role-relevant pages. Type a forbidden URL (e.g. `/staff` as a facilitator). ✅ "Access denied" page, not a blank page.
2. DS Lagos vs DS Ibadan: ✅ each sees only their district (queues and dashboard counts).
3. Approval ageing: the "Waiting" column in queues shows due soon / overdue (indicator only).
4. Refresh any page, or open a deep link such as `/bookings`. ✅ Still works (no 404).
5. Resize the window to phone width (375px). ✅ Hamburger menu, no sideways scrolling.
6. **Demo guide** (`/demo-guide`): click through the scenes' **Go** buttons. ✅ Each opens the right role/page.
7. **Reset demo** → ✅ all seeded data restored.

---

If anything differs from an ✅, note the page, role and exact steps and tell me.
