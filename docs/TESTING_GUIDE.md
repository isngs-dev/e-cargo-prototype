# NRC e-Cargo — complete step-by-step testing guide

Site: https://nrc-ecargo-prototype.onrender.com (or `npm run dev` → http://localhost:5173)

## Read this first

- **Do Reset demo only ONCE, at the very start.** Parts 1–10 are one continuous story: later parts use records created in earlier parts. Do the Parts in order.
- Switch role with the **dropdown at the top right** (it shows the current person's name). Every step says **WHO** to be.
- Everything is simulated. Data lives only in your browser.
- Lines starting **✅** are what you should see. If something differs, note the Part and step number and tell me.
- **Dates:** the guide uses November 2026. If your computer's date is later than 10 Nov 2026, the form will refuse dates in the past; add the same number of days to every date you type.
- Entries are identified by their **reference** (e.g. `REG-2026-0108`, `NRC-BK-2026-0421`). Use the search box on the list page if you can't find one.

### People you will use

| Person (dropdown name) | Role | Company |
|---|---|---|
| Adaeze Okafor | Cargo Facilitator, **Priority** (10% discount, 2 months credit) | Lagoon Freight & Logistics Ltd |
| Ibrahim Musa | Cargo Facilitator, **Non-Priority** | Apapa Gateway Clearing Services Ltd |
| Obinna Chukwu | **New applicant** (not yet a customer) | — |
| Chukwuemeka Obi | District Supervisor **Lagos** | |
| Olumide Adeyemi | District Supervisor **Ibadan** | |
| Funmilayo Adebayo | Head of Cargo | |
| Aliyu Bello | Director of Operations | |
| Grace Etim | Head of Port Operations | |
| Tunde Bakare | Super Admin | |

### The values to type (use these exactly)

**New booking (used in Part 3):**

| Field | Type this |
|---|---|
| Booking date | `12 Nov 2026` (2026-11-12) |
| Cargo type | Containerized |
| Route | Apapa Port → Ebute Metta (14 km) |
| Container line | **20ft**, quantity **2** |
| Total weight (tons) | `38` |
| Commodity type | `Packaged beverages` (start typing and pick it) |
| Hazardous cargo | No |
| Special handling / Remarks | leave empty |
| Documents | click **Use sample file** on Bill of Lading, Packing List, Invoice |

**Dispatch form (used in Part 6):** Wagon number `NRC-FW-30001` · Train number `LI-FR-11` · Departure date `15 Nov 2026` · Departure time `06:30` · Loading yard `Apapa Yard A` · tick **all** the verification boxes.

**Refund bank details (Part 7):** Bank name `Demo Bank` · Account name `Lagoon Freight & Logistics Ltd` · Account number `0123456789`.

---

## Part 0 — Start clean, public pages (5 min)

1. Open the site. Click **Open the platform**. In the top bar click **Reset demo** → **Reset data**.
2. Go to `/` (click the site address, remove everything after it). ✅ Landing page loads, **no "Prototype" banner**.
3. Scroll through Services, How it works, Train availability, FAQ. ✅ Header turns solid after the hero.
4. Click **Verify an AWB**, type `NRC-AWB-26-000000-0`, verify. ✅ A "not found / not valid" message, no crash.
5. Click **Open the platform**. ✅ Dashboard opens.
6. Click the **NRC logo** at the top of the sidebar. ✅ Goes to the dashboard.
7. Click the **collapse icon** beside the logo. ✅ Sidebar becomes icons only; refresh the page, it stays collapsed. Click the expand icon.

---

## Part 1 — New customer registration (Harbour Link)

### 1A — Applicant submits
WHO: **Obinna Chukwu** → sidebar **My Registration**.

1. Don't fill anything. Click **Next**. ✅ Red messages on every required field including **District**.
2. Click **Fill demo data**. ✅ The form fills with: Harbour Link Logistics Ltd · RC 3412207 · 12 Marine Road, Apapa, Lagos · District **Lagos** · Containerized · Clearance + Multi-modal · Zainab Lawal.
3. Click **Next**. Click **Next** again without documents. ✅ Blocked: CAC Certificate and Company Profile are mandatory.
4. Click **Use sample file** on **CAC Certificate** and on **Company Profile** (leave Tax Certificate empty). Click **Next**.
5. Review page shows the District. Click **Submit**. ✅ New application **REG-2026-0108**, status **Pending District Verification**, timeline started.

### 1B — District scoping
WHO: **Olumide Adeyemi** (Ibadan) → **Registration Queue**.
6. ✅ You see Ibadan applications only (e.g. **REG-2026-0101** Ogun Valley, **REG-2026-0106** Benin-Ore). **REG-2026-0108 is NOT there** (it is a Lagos application).

### 1C — District Supervisor Lagos reviews three applications
WHO: **Chukwuemeka Obi** (Lagos) → **Registration Queue**. Open these three, in this order:

7. **REG-2026-0102 — Eko Bulk Terminals Ltd** (missing Company Profile).
   - ✅ Automated checks show **Incomplete documentation** (flagged).
   - Click **Verified — forward to Director**. ✅ Refused because documents are incomplete.
   - Click **Send back to facilitator**, leave the comment empty → ✅ refused. Type `Company profile missing, please upload` → confirm. ✅ Status **Sent Back to Facilitator**.
8. **REG-2026-0107 — Swift Delta Movers Nig. Ltd** (CAC RC 2776120 already belongs to blacklisted customer *Delta Swift Movers Ltd*).
   - ✅ Flags for **duplicate CAC / blacklisted customer**.
   - Click **Verified — forward to Director** with no remarks. ✅ Refused (a flagged application needs explanatory remarks). Don't forward it; leave it as it is.
   - Optional: type a note in **Internal remark** → **Add remark**. ✅ Note appears in the timeline (internal remarks are hidden from the applicant).
9. **REG-2026-0108 — Harbour Link Logistics Ltd** (yours).
   - ✅ All checks pass.
   - Click **Send back to facilitator** with comment `CAC document unclear, please re-upload`. ✅ Sent Back to Facilitator.

### 1D — Applicant corrects
WHO: **Obinna Chukwu** → **My Registration**.
10. ✅ You see your application with the DS comment. Under **Action required** click **Correct & resubmit**.
11. Click **Next**, **Next**, then **Resubmit application**. ✅ Back to **Pending District Verification**.

### 1E — Forward
WHO: **Chukwuemeka Obi** → open **REG-2026-0108** → **Verified — forward to Director** (remarks optional).
12. ✅ Status **Pending Director Approval**.

### 1F — Director decides
WHO: **Aliyu Bello** → **Registrations**. Waiting for the Director: **REG-2026-0103 Trans-Sahel** and **REG-2026-0108 Harbour Link** (plus **REG-2026-0107 Swift Delta** if you forwarded it). Ogun Valley arrives later, in 1G.

13. Open **REG-2026-0103 — Trans-Sahel Freight Nigeria Ltd** → click **Reject**, reason `Test rejection - incomplete trade references`. ✅ Status **Rejected**.
14. Open **REG-2026-0108 — Harbour Link**. In the eligibility form enter: **Priority**, discount **10**, credit period **2** months, credit threshold **5000000**, category **Strategic**. Click **Approve & activate**.
    ✅ Status **Activated**. A username is shown and the credentials email is marked *simulated* (no password shown).
15. Go to **Customers**. ✅ Harbour Link Logistics Ltd is listed (District Lagos, Priority, Strategic).

### 1G — Non-Priority approval and the Ibadan flow
16. WHO **Olumide Adeyemi** → open **REG-2026-0101 Ogun Valley** → **Verified — forward to Director**. ✅ Pending Director Approval. (Ogun Valley has all documents.)
17. WHO **Aliyu Bello** → open **REG-2026-0101** → choose **Non-Priority**. ✅ Discount and credit fields lock to 0. Category **SME** → **Approve & activate**. ✅ Activated.
18. (Optional) Back as Olumide, open **REG-2026-0106 Benin-Ore** (sent back to district by the Director). ✅ Remark shown; you can forward it again.

### 1H — Audit
19. WHO **Tunde Bakare** → **Audit Log**. Search `REG-2026-0108`. ✅ Every step from 1A–1F is listed with who, role, time, and from → to status.

---

## Part 2 — Rules for the booking form (no booking is created)

WHO: **Ibrahim Musa** (Non-Priority) → **New Booking**.

**A. Empty form**
1. Click **Next** without typing anything. ✅ Red messages on the empty fields (date, route, weight, commodity).

**B. Normal price**
2. Fill in: date `12 Nov 2026` · Cargo type Containerized · Route Apapa Port → Ebute Metta · Container line **20ft**, quantity **2** · Weight `38` · Commodity `Packaged beverages`. ✅ **No discount line**, total **₦197,550.00**.

**C. Missing rate**
3. Change Cargo type to **Non-Containerized**, route **Apapa Port → Moniya (Ibadan)**, wagon quantity `1`. ✅ Red "no rate configured" message; **Next** is blocked (never priced at ₦0).
4. Change Cargo type back to **Containerized**.

**D. Maintenance day and waitlist**
5. Route Ebute Metta, 20ft × 2, date `30 Oct 2026`. ✅ "No slots" message with a **Join waitlist** button.
6. Click **Join waitlist**. ✅ Confirmation (it is not a booking).
7. Set the date back to `12 Nov 2026`.

**E. Hazardous and documents**
8. Set **Hazardous cargo** to **Yes**, click **Next**. ✅ **Hazardous compliance** document is mandatory on the Documents step.
9. Click **Back**, set Hazardous to **No**, click **Next**.
10. On Documents click **Next** with nothing attached. ✅ Blocked: Bill of Lading, Packing List and Invoice are mandatory.
11. Click **Use sample file** on those three, then **Next**.

**F. Declaration**
12. On Review click **Submit booking** without ticking the declaration. ✅ Refused with a message.
13. **Do not tick it or submit.** Click **My Bookings**. ✅ A **Waitlist (1)** card shows the entry from step 6 ("not a booking"). Click **Remove** on it. ✅ Removed.

---

## Part 3 — Priority customer booking, full approval loop

### 3A — Create
WHO: **Adaeze Okafor** → **New Booking**.

1. Fill in: Booking date `12 Nov 2026` · Cargo type Containerized · Route Apapa Port → Ebute Metta (14 km) · Container line **20ft**, quantity **2** · Total weight `38` · Commodity `Packaged beverages` · Hazardous **No** · leave Special handling and Remarks empty.
   ✅ Price panel shows a **discount line (Indicative)** and a total of **₦177,795.00** (base ₦180,000, 10% discount).
2. Click **Next**. Click **Use sample file** on Bill of Lading, Packing List and Invoice. **Next**. On Review tick **I confirm compliance with NRC Fair Cargo Policy…** and click **Submit booking**.
   ✅ New booking **NRC-BK-2026-0421**, status **Pending Head of Cargo Review**. No payment was asked.

### 3B — Head of Cargo (3 bookings in the queue: 0418, 0419, 0421)
WHO: **Funmilayo Adebayo** → **Booking Reviews**.

3. Open **NRC-BK-2026-0421**. ✅ There are no discount or payment-terms fields (that is the Director's job).
4. Click **Send back** with empty comment → ✅ refused. Comment `Packing list does not match invoice` → ✅ **Sent Back to Facilitator**.

### 3C — Applicant corrects
WHO: **Adaeze Okafor** → **My Bookings** → **NRC-BK-2026-0421**.
5. ✅ You see the comment. Click **Correct & resubmit** under **Action required**. **Next**, **Next**, tick the declaration, **Resubmit**.
   ✅ Same reference 0421, back to **Pending Head of Cargo Review**.

### 3D — Forward both (0421 and 0418)
WHO: **Funmilayo Adebayo**.
6. Open **0421** → **Verified — forward to Director**. ✅ **Pending Director Review**.
7. Open **0418** (Lagoon, seeded, 2 × 20ft) → **Verified — forward to Director**. ✅ Pending Director Review.
8. Open **0419** (Apapa Gateway, Non-Priority) → **Reject**, reason `Documents incomplete`. ✅ Status **Rejected**, no refund needed. *(Non-Priority approval is tested in Part 4 with a new booking.)*

### 3E — Director approves 0421 (this freezes the price)
WHO: **Aliyu Bello** → **Bookings**. The Director queue now has **0421**, **0418** and the seeded **0412** (Northbound, hazardous).

9. Open **NRC-BK-2026-0421**. Under **Final decision**:
   - Type discount **12** → click **Approve & freeze price**. ✅ A red message says the maximum is 10% (no dialog opens).
   - Type discount **8**, leave the reason empty → click **Approve & freeze price**. ✅ Red message: a reason is required.
   - Reason `Promotional rate for repeat customer`. Payment terms **Payment link now**.
   - ✅ Live price shows total **₦181,746.00**.
10. Click **Approve & freeze price**. ✅ A **confirmation dialog** shows the total, discount and terms. Click **Cancel**: nothing changes. Click the button again, then **Approve & freeze**.
    ✅ Status **Awaiting Payment**, price marked **Approved (frozen)** ₦181,746.00, an invoice and a *simulated* payment link.
11. Open **NRC-BK-2026-0412** (Northbound Agro, hazardous). Click **Reject**, reason `Hazardous declaration inconsistent`. ✅ Rejected.
12. Open **NRC-BK-2026-0418** (Lagoon). Choose terms **Payment link after credit period**. Enter credit period **3** → click **Approve & freeze price** → ✅ red message (maximum 2). Enter **2**, discount **8**, reason `Strategic customer loyalty`, **Approve & freeze price** → confirm.
    ✅ Status **Credit Approved** (no payment needed).

---

## Part 4 — Non-Priority customer approval, send-back to Head of Cargo

**4A. Create 0422** — WHO: **Ibrahim Musa** → **New Booking**.
1. Fill in: Booking date `12 Nov 2026` · Containerized · Route Apapa Port → Ebute Metta · Container line **20ft**, quantity **2** · Weight `38` · Commodity `Packaged beverages` · Hazardous **No**.
2. **Next** → click **Use sample file** on Bill of Lading, Packing List and Invoice → **Next**.
3. Tick the Fair Cargo Policy box → **Submit booking**. ✅ New booking **NRC-BK-2026-0422**, total **₦197,550.00**, no discount line.

**4B. Head of Cargo forwards** — WHO: **Funmilayo Adebayo**.
4. Open **0422** → **Verified — forward to Director**. ✅ Pending Director Review.

**4C. Director sends it back** — WHO: **Aliyu Bello**.
5. Open **0422**. ✅ The discount field is disabled and **Payment link after credit period** is greyed out (Non-Priority: Pay Now only).
6. Click **Send back**, reason `Please re-check the weight`, confirm. ✅ Status returns to **Pending Head of Cargo Review**.

**4D. Forward again and approve**
7. WHO **Funmilayo Adebayo** → open **0422** → **Verified — forward to Director** again.
8. WHO **Aliyu Bello** → open **0422** → **Approve & freeze price** → confirm. ✅ **Awaiting Payment**, total ₦197,550.00.

---

## Part 5 — Payment (simulated) and Super Admin payment controls

*Leave booking **0401** alone in this Part — it is used in Part 8.*

### 5A — Pay booking 0421
WHO: **Adaeze Okafor** → **My Bookings** → **NRC-BK-2026-0421**.
1. ✅ A **Payment due** card clearly labelled **simulated**.
2. Click **Payment fails**. ✅ Stays **Awaiting Payment**; you can retry.
3. Click **Pay successfully**. ✅ Status **Pending Dispatch**, payment **Paid (simulated)**.

### 5B — Reconcile a pending payment (booking 0422)

**Step 1 — customer attempts a payment.** WHO: **Ibrahim Musa**.
4. **My Bookings** → open **NRC-BK-2026-0422**.
5. In the **Payment due** card, under *Choose a simulated outcome*, click **Stays pending**. ✅ The card says "Payment processing (simulated) — waiting for gateway confirmation".

**Step 2 — Super Admin reconciles.** WHO: **Tunde Bakare**.
6. **Bookings** → open **NRC-BK-2026-0422**.
7. Under **Demo controls (Super Admin)** click **Reconcile — payment received**. ✅ Status **Pending Dispatch**, Paid (simulated). *(Reconcile only appears after step 5.)*

### 5C — Reminder and auto-cancel (booking 0420)
WHO: **Tunde Bakare** → **Bookings** → open **NRC-BK-2026-0420** (Northbound Agro, payment failed).
8. Under **Demo controls (Super Admin)** click **Send 24h reminder**. ✅ "Reminder sent" notice and an audit entry.
9. Click **Payment window elapses → auto-cancel**. ✅ Status **Auto-Cancelled**.

### 5D — Credit settlement (booking 0418)
**Step 1.** WHO: **Tunde Bakare** → open **NRC-BK-2026-0418** (Credit Approved).
10. Click **Credit period ends → issue payment link**. ✅ A payment link appears.

**Step 2.** WHO: **Adaeze Okafor** → **My Bookings** → open **0418**.
11. Click **Settle balance**. ✅ Credit settled (simulated).

### 5E — Super Admin has no approval power
12. WHO **Tunde Bakare**, on any booking: ✅ no Approve, Reject or discount buttons; the page says "View only (approvals)".

---

## Part 6 — Port dispatch and AWB

### 6A — Gate checks
WHO: **Grace Etim** → **Dispatch Queue**.
1. ✅ Queue contains **0421** (paid), **0422** (reconciled), **0398** (Steel billets, paid, seeded), **0418** (credit) and **0405** (credit, seeded). **0401** is NOT there (still unpaid).
2. Open **NRC-BK-2026-0420** from **All Bookings** (cancelled earlier). ✅ No dispatch form (it is cancelled).

### 6B — Dispatch 0421
3. Open **NRC-BK-2026-0421** and click **Approve dispatch & generate AWB** with the form empty. ✅ Refused; wagon, train, date, time and the checklist are mandatory.
4. Enter: Wagon number `NRC-FW-30001` · Train number `LI-FR-11` · Departure date `15 Nov 2026` · Departure time `06:30` · Loading yard `Apapa Yard A`, and tick all 3 verification boxes.
5. Click **Approve dispatch & generate AWB**. ✅ Status **AWB Generated**, an **AWB number** like `NRC-AWB-26-000102-x`. Write it down.
6. Refresh the page and look at the AWB number again. ✅ The **same** number (it is never regenerated).

### 6C — Customer views AWB
WHO: **Adaeze Okafor** → **NRC-BK-2026-0421** → **View AWB**.
7. ✅ A "demonstration" AWB with QR code, version **1**, route, containers, train/wagon, departure.
8. Click the browser's Print (Ctrl+P). ✅ Clean print layout.

### 6D — Verify
9. Go to `/verify` (or the **Verify an AWB** link on the landing page). Enter the AWB number from step 5. ✅ **Valid**.

### 6E — Amend the AWB
WHO: **Grace Etim** → **NRC-BK-2026-0421** → **Amend dispatch details**.
10. Change Train number to `LI-FR-12`, reason `Train changed due to schedule`. Click **Issue amended AWB**.
    ✅ Same number, now **version 2**. Check `/verify` with the same number: ✅ valid, shows v2; v1 is shown as **superseded**.
11. Open **AWBs**. ✅ The register lists 0421 with its versions.
12. On the booking click **Mark as delivered & complete**. ✅ Status **Completed**.

### 6F — Credit booking dispatch
13. WHO **Grace Etim** → open **NRC-BK-2026-0418**. Tick all 3 verification boxes. Enter Wagon number `NRC-FW-30002` · Train number `LI-FR-11` · Departure date `15 Nov 2026` · Departure time `07:30` · Loading yard `Apapa Yard B` · Remarks empty. Click **Approve dispatch & generate AWB**. ✅ AWB generated with a new number (credit-approved bookings qualify for dispatch whether or not the balance is settled).

### 6G — Pay-Now gate (booking 0423)
*Goal: a booking approved with "Payment link now" must NOT be dispatchable until it is paid. So you create it, approve it, and deliberately **do not pay**.*

**Step 1 — create.** WHO: **Ibrahim Musa** → **New Booking**.
14. Fill in: date `12 Nov 2026` · Containerized · Route Apapa Port → Ebute Metta · **20ft** × **2** · Weight `38` · Commodity `Packaged beverages` · Hazardous **No**. **Next** → **Use sample file** on the three documents → **Next** → tick the declaration → **Submit booking**. ✅ **NRC-BK-2026-0423**.

**Step 2 — Head of Cargo.** WHO: **Funmilayo Adebayo** → open **0423** → **Verified — forward to Director**.

**Step 3 — Director.** WHO: **Aliyu Bello** → open **0423** → payment terms **Payment link now** (discount field is disabled) → **Approve & freeze price** → confirm. ✅ **Awaiting Payment**, ₦197,550.00.

**Step 4 — do NOT pay.** Do not switch to Ibrahim and do not click any payment button on 0423.

**Step 5 — check the gate.** WHO: **Grace Etim**.
15. **Dispatch Queue**. ✅ 0423 is not listed. Open **0423** from **All Bookings**. ✅ A "Held until payment clears" notice and no dispatch form.

---

## Part 7 — Failed physical check, refund, reversal

### 7A — Head of Port fails 0398
WHO: **Grace Etim** → **Dispatch Queue** → **NRC-BK-2026-0398** (Apapa Gateway, Steel billets, paid).
1. Click **Physical check failed — cancel & report to Director** with no reason. ✅ Refused. Reason `Weight mismatch on wagons`. ✅ Status **Rejected — Physical Verification Failed**.

### 7B — Director triggers
WHO: **Aliyu Bello** → **Refunds** (cards). You'll see two cards awaiting you: **NRC-BK-2026-0380 (Lagoon)** (seeded) and **NRC-BK-2026-0398** (new).
2. Open the **0380** card → **Trigger refund link**. ✅ Tracker moves to **Refund link sent** (email simulated).

### 7C — Facilitator requests
WHO: **Adaeze Okafor** → **Refunds** → open the 0380 card → **Submit refund request**.
3. Click **Submit request** empty. ✅ Refused. Enter Bank name `Demo Bank` · Account name `Lagoon Freight & Logistics Ltd` · Account number `0123456789` · Confirm refund amount `632160` (the amount shown in the label) · tick the policy box → submit.
   ✅ Status **Requested**. Only the **last 4 digits** (6789) are kept.

### 7D — Super Admin processes
WHO: **Tunde Bakare** → **Refunds** → open the **0380** card. The page shows only the next allowed action (steps cannot be skipped).
4. Click **Start review**. ✅ Tracker: Under review; button becomes **Approve refund**.
5. Click **Approve refund**. ✅ Tracker: Approved; button becomes **Process refund (simulated)**.
6. Click **Process refund (simulated)**. ✅ Tracker: Processed; disbursement section appears (simulated Paystack).
7. Click **Reverse this refund**, reason `Processed in error - test`, confirm. ✅ A "Reversed" section appears; the original record is unchanged; the reverse button disappears (only once).
8. Separation of duties: as **Aliyu Bello** open the same refund → ✅ no Start review / Approve / Process button. As **Tunde Bakare** open the new refund for **0398** (still awaiting the Director) → ✅ no Trigger refund link button.

---

## Part 8 — Payment exceptions (Super Admin)

WHO: **Tunde Bakare** → **Payment Exceptions** (cards). Three exceptions are waiting. Each page offers three options: *Match to an open invoice*, *Duplicate payment — start the refund flow*, *Return to sender*. Greyed-out options tell you why they are unavailable. A **Resolution note** is always required.

1. Open **DEMO-PSK-76233** (₦164,625.00 — equals the open invoice for booking 0401). Choose **Match to an open invoice**; the **Invoice** box shows **NRC-BK-2026-0401**. Note `Matched to 0401`. **Resolve exception**. ✅ Resolved; booking 0401 is now **Pending Dispatch**.
2. Open **DEMO-PSK-75870-DUP** (duplicate payment for booking 0380). Choose **Duplicate payment — start the refund flow**, note `Duplicate confirmed`, resolve. ✅ Resolved; a new refund for 0380 appears under **Refunds**, awaiting the Director.
3. Open **DEMO-PSK-76011** (₦214,000.00). ✅ *Match* and *Duplicate* are greyed out (no matching invoice; not linked to a booking). Choose **Return to sender**, note `Returned`, resolve. ✅ Resolved.
4. WHO **Aliyu Bello** → **Payment Exceptions**. ✅ He can view them but sees "Only Super Admin resolves payment exceptions."

---

## Part 9 — Staff, customers, capacity, rates (Super Admin / Director)

### 9A — Staff Accounts
WHO: **Tunde Bakare** → **Staff Accounts**.
1. Click **Create account**: Full name `Test Supervisor`, Email `test.supervisor@nrc.demo`, Role **District Supervisor**, District **Ibadan**. ✅ Created as *Pending first login*, email simulated, no password displayed.
2. On the Test Supervisor row click **Reset password** → confirm in the dialog (no reason box). ✅ Message "Password reset… (email simulated)"; status stays *Pending first login*; no password shown.
3. Click **Suspend**, reason `Test suspension`, confirm. ✅ Status **Suspended**; **Reset password** disappears and **Reactivate** replaces **Suspend**.
4. Click **Reactivate**, reason `Test`, confirm. ✅ Status **Active**.
5. Click **Reassign**, keep role District Supervisor, set District **Lagos**, reason `Test`, confirm. ✅ Row shows Lagos.
6. Click **Revoke**, reason `Test`, confirm (the dialog warns it is permanent). ✅ Row shows **Revoked** with no buttons.
7. ✅ The Tunde Bakare row shows **Protected** with no actions.

### 9B — Customers
8. **Suspend a customer.** WHO **Tunde Bakare** → **Customers** → open **Apapa Gateway Clearing Services Ltd** → **Suspend**, reason `Test suspension`, confirm. ✅ Status Suspended.
9. **Check the block.** WHO **Ibrahim Musa** → **New Booking** → fill the usual values (date `12 Nov 2026` · Containerized · Ebute Metta · 20ft × 2 · weight `38` · `Packaged beverages`), sample files, tick the declaration, **Submit booking**. ✅ Red message: "Your account is suspended. Contact NRC Cargo Operations." No booking is created.
10. **Undo it (do not skip).** WHO **Tunde Bakare** → **Customers** → **Apapa Gateway Clearing Services Ltd** → **Reactivate**, reason `Test finished`, confirm. ✅ Status Active.
11. **Record correction.** WHO **Tunde Bakare**, same customer: change **Contact name** to `Ibrahim Musa Jr`, reason `Typo fix`, **Save correction**. ✅ Saved and audited. ✅ There is **no** way to change discount or credit here. *(Change the contact name back to `Ibrahim Musa` the same way.)*
12. **Eligibility is not retroactive.** WHO **Aliyu Bello** → **Customers** → **Lagoon Freight & Logistics Ltd** → change the discount to **5**, reason `Review`, **Save eligibility change**. ✅ Saved; the audit log shows old → new.
13. Open **NRC-BK-2026-0421**. ✅ Still **8%** and ₦181,746.00. Then set Lagoon's discount back to **10** (reason `Restore`).

### 9C — Capacity
14. WHO **Tunde Bakare** → **Train Capacity** → click **Edit capacity & maintenance** (this opens the **Routes & Rates** page). In the *Train capacity & maintenance* card click **Add maintenance block**: Route **Apapa Local**, Date **20 Nov 2026**, Reason `Test works`. ✅ Listed under Maintenance blocks (next to the two demo blocks, which you leave alone).
15. WHO **Ibrahim Musa** → **New Booking** → Containerized, route **Apapa Port → Apapa Local**, **20ft** × **1**, date **20 Nov 2026**. ✅ "No slots" message and a **Join waitlist** button (do not join).
16. WHO **Tunde Bakare** → same card → **Remove** on the Apapa Local 20 Nov block. ✅ Gone.

### 9D — Routes & Rates
17. WHO **Tunde Bakare** → **Routes & Rates** → **Add rate**: Route Apapa Port → Ebute Metta, Cargo type Containerized, type **20ft**, Rate `95000`, Effective from **25 Nov 2026**. ✅ New row; the old rate stays in history.
18. **Edit configuration** → change **Payment window (hours)** to `48`, reason `Test`. ✅ One audit entry for the change.
19. Open **NRC-BK-2026-0421** again. ✅ Still ₦181,746.00 (frozen prices never change).

---

## Part 10 — Access control, audit, mobile, wrap-up

1. As each of the 9 people, look at the sidebar. ✅ Only role-relevant pages. Type `/staff` after the site address as **Adaeze**. ✅ "Access denied" page, not blank.
2. As **Chukwuemeka Obi** and **Olumide Adeyemi**: ✅ each sees only his own district's applications and dashboard counts.
3. WHO **Funmilayo Adebayo** → **Booking Reviews**, and WHO **Aliyu Bello** → **Registrations**. ✅ A **Waiting** column shows how long each open item has waited: fresh items show e.g. `0h`; old seeded items (e.g. booking **0405**, registration **0106**) show `… · escalate`; finished items show `—`. It is only an indicator; nothing is auto-approved. Adaeze Okafor has no Waiting column.
4. As **Tunde Bakare** → **Audit Log**: filter **actor role = Director**, set a date range, search `0421`. ✅ Filters work. Click **Export CSV**. ✅ A file downloads.
5. Open a booking's page and refresh (F5). ✅ Still works (no 404).
6. Resize the browser to phone width. ✅ Hamburger menu; no sideways scrolling.
7. Open **Demo guide** (top bar). Click a few **Go** buttons. ✅ Each switches role and opens the right page.
8. **Do this last, after Part 11:** click **Reset demo** → **Reset data**. ✅ Everything returns to the starting data (0421 and Harbour Link disappear).

---

## Part 11 — Reports & Analytics (Director and Super Admin)

*Do this after Parts 1–9, so the dashboard also contains the records you created. Reports only read data; nothing here changes it.*

### 11A — Who can see it
1. WHO **Aliyu Bello** (Director). ✅ The sidebar has **Reports & Analytics**. Open it.
2. WHO **Tunde Bakare** (Super Admin). ✅ Same item, same page.
3. For each of **Adaeze Okafor**, **Ibrahim Musa**, **Chukwuemeka Obi**, **Olumide Adeyemi**, **Funmilayo Adebayo**, **Grace Etim**: ✅ no Reports item in the sidebar. Type `/reports` after the site address. ✅ "Not available to …" page, not the dashboard.

### 11B — Read the page (as Aliyu Bello)
4. Top of the page. ✅ Title *Reports & Analytics*, the description, **Last updated** (the latest activity in the data) and **Clear filters**.
5. The filter bar. ✅ Period, District, Booking status, Payment status, Route, and a **Showing** line listing what is applied (default: *Last 30 days*, *All districts*).
6. ✅ Six cards: **AWBs generated**, **Registrations** (pending / approved / with applicant / rejected), **Bookings** (pending approval / approved or completed / completed), **Revenue received**, **Net revenue**, **Receivables (not revenue)**. Cards show a green or red arrow with a percentage and the previous-period figure — or a plain sentence when no honest comparison exists.
7. ✅ Two line charts (**Activity over time**, **Revenue over time**). Hover a chart: a tooltip shows the values for that point.
8. ✅ Booking status and Registration status donuts, **Priority vs Non-Priority**, then **By district**, **By route** and **Revenue position**.
9. ✅ At the bottom, **Detailed records** with four tabs (**Bookings**, **AWBs**, **Registrations**, **Payments received**), a search box and **Export CSV**.

### 11C — Filters change everything together
10. Set **Period** to **All time**. ✅ Cards, charts and tables all change; the cards say "No prior-period comparison for this range".
11. Set **District** to **Lagos**, note the Bookings, Registrations and AWBs numbers; then **Ibadan**. ✅ Lagos + Ibadan numbers add up to the **All districts** numbers. The *By district* card shows the other district at zero.
12. Set **Payment status** to **Paid (simulated)**. ✅ Bookings and revenue narrow; the **Registrations** card does **not** change.
13. Set **Route** to **Apapa Port → Moniya (Ibadan)**. ✅ Only Moniya bookings appear in the table.
14. Set **Period** to **Custom range**, From `2000-01-01`, To `2000-01-31`. ✅ A "No records match these filters" message, zeros on the cards, and "No activity in this period" in the charts. Click **Clear filters**. ✅ Back to *Last 30 days* / *All districts*.

### 11D — The money is honest
15. Set **Period** to **All time**, **Payment status** to **All payments**. Open the **Payments received** tab. ✅ Only bookings that were paid or credit-settled appear. Booking **0423** (awaiting payment, from Part 6G) is **not** in this tab.
16. Open the **Bookings** tab and search `0423`. ✅ It is listed as **Awaiting Payment** with a *Frozen* amount, and that amount is counted under **Receivables / Awaiting payment**, not under **Revenue received**.
17. In **Revenue position**: ✅ *Gross received − Refunds processed = Net received*. The seeded refund for booking **0352** (₦177,795.00) is deducted. The refund you processed and then **reversed** for booking **0380** in Part 7 is **not** deducted; in the Payments tab 0380 shows **Reversed**.
18. ✅ *Approved credit outstanding* (e.g. booking **0405**) is listed under *Not yet received (not revenue)*; once a credit booking is settled (e.g. 0418 in Part 5) it moves into revenue.

### 11E — Drill-down and export
19. In **Detailed records** click a booking reference. ✅ Opens that booking's page. Go back, open the **AWBs** tab and click an AWB number. ✅ Opens the AWB page. Open **Registrations** and click a reference. ✅ Opens the registration page. Registration rows show the **Review stage** (District Supervisor / Director / Applicant / Closed).
20. Click **Export CSV**. ✅ A file downloads containing the rows currently shown.
21. Resize the browser to phone width. ✅ Filters stack, charts shrink to fit, tables scroll sideways inside their card, and the page itself does not scroll sideways.

---

### Quick reference — seeded records used

| Reference | What it is | Used in |
|---|---|---|
| REG-2026-0102 Eko Bulk | Lagos, missing Company Profile | 1C |
| REG-2026-0107 Swift Delta | Lagos, duplicate CAC / blacklisted | 1C |
| REG-2026-0103 Trans-Sahel | Waiting for Director | 1F (reject) |
| REG-2026-0101 Ogun Valley | Ibadan, pending DS | 1G (Non-Priority approve) |
| REG-2026-0106 Benin-Ore | Ibadan, sent back to district | 1G |
| NRC-BK-2026-0418 | Lagoon, pending Head of Cargo | 3D, 3E (credit), 6F |
| NRC-BK-2026-0419 | Apapa Gateway, pending Head of Cargo | 3D (reject) |
| NRC-BK-2026-0412 | Northbound, hazardous, pending Director | 3E (reject) |
| NRC-BK-2026-0401 | Apapa Gateway, payment pending | Part 8 (matched to payment 76233) |
| NRC-BK-2026-0420 | Northbound, payment failed | 5C (reminder, auto-cancel) |
| NRC-BK-2026-0398 | Apapa Gateway, paid, pending dispatch | 7A (fail) |
| NRC-BK-2026-0380 / refund | Lagoon, failed physical check | 7B–7D |
| Payment exceptions 76233, 75870-DUP, 76011 | Super Admin queue | 8 |
| NRC-BK-2026-0405 | Lagoon, credit, waiting since 8 Oct | 6A (dispatch queue), Part 10 (escalate) |

New records you create: **REG-2026-0108**, **NRC-BK-2026-0421**, **0422**, **0423**.
