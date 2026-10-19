# NRC e-Cargo — Presentation Script

Site: **https://nrc-ecargo-prototype.onrender.com** *(when testing on your computer, use http://localhost:5173 instead)*

Two journeys:
- **Journey A** — a new company registers, is approved, sets its password, books, pays and receives its AWB.
- **Journey B** — the same company's second booking is rejected, and the company is told.

---

## How things work during the demo

**Changing user (main platform)**
1. Top-right → click your **name** → **Sign out**.
2. On the sign-in page click the **post** you want, e.g. *Director of Operations*. Username and password fill in by themselves.
3. Click **Sign in**.

*The sign-in list has two groups: **NRC staff**, then **Cargo facilitators**. A company that registers is added to the facilitators once the Director approves it — as **Harbour Link Logistics Ltd (Priority, new)**, showing the contact person's name. Its row fills only the **email address**; you type the password yourself.*

**Mail Outbox (emails)** — a separate, simple blue page
- Open it in a **second browser tab**: https://nrc-ecargo-prototype.onrender.com/mail
- Click an **address** on the right → **Sign in**.
- To look at someone else's mail: **Switch mailbox** (top-right) → click another address → **Sign in**.
- New emails appear by themselves while you work in the first tab.

---

**Good to know:** after an officer's *final* action (approve, forward, send back, reject, approve dispatch) the app takes them back to the page they came from, with a green confirmation — so open the record from the list or dashboard and you land back there. Photos, remarks and similar steps stay on the page.

## Before you start (every time)
1. Open https://nrc-ecargo-prototype.onrender.com/login → click any post → **Sign in**.
2. Top bar → **Reset demo** → **Reset data**.
3. Top-right → your name → **Sign out**.
4. Open the Mail Outbox in a second tab: https://nrc-ecargo-prototype.onrender.com/mail
5. In the first tab open the landing page: https://nrc-ecargo-prototype.onrender.com/

---

# Journey A — Registration to AWB

## A1. Landing page
Scroll through **Services**, **How it works**, **Train availability** and **FAQ**.
> *"This is the public website. A company learns how it works and registers here."*

## A2. The company registers (no sign-in needed)
1. Click **Register your company**.
2. Click in **Company name** and press **Tab** — the grey sample fills in. Keep pressing **Tab** through **CAC number** and **Registered address**.
3. **District** → **Lagos**. Tick **Containerized** and **Clearance**.
4. Click in **Point of contact name** and press **Tab** twice (name, then email). Then click in the **phone** box and press **Tab**.
   *(You can type your own values anywhere instead of the samples.)*
5. Click **Next**.
6. Click **Use sample file** on **CAC Certificate**, then on **Company Profile**. Click **Next**.
7. Check the summary → **Submit application**.

✅ "Application submitted" — **REG-2026-0108**.
> *"No paperwork, no office visit. It goes straight to the Lagos District Supervisor."*

**Track it:** click **Track your application** (or use **Track application** in the hero of the landing page and type `REG-2026-0108`).
✅ Status **Pending District Verification** with a four-step progress bar — no sign-in needed. *(Credentials only exist after the Director approves.)*

**Mail tab:** under **Customers** click **Harbour Link Logistics Ltd (new company)** → **Sign in**.
✅ The **application received** email is there — sent to the email typed on the form.

## A3. District Supervisor verifies
1. Sign in as **District Supervisor (Lagos)**.
2. Open https://nrc-ecargo-prototype.onrender.com/registrations/reg-108
3. Point at **Automated checks**: duplicate CAC, blacklist, documents — all passed.
4. Click **Verified — forward to Director** → **Forward**.

✅ **Pending Director Approval**.
> *"Supervisors only see their own district. Duplicates and blacklisted companies are flagged automatically."*

## A4. Director approves the company
1. Sign in as **Director of Operations**.
2. Open https://nrc-ecargo-prototype.onrender.com/registrations/reg-108
3. Under **Final decision** click **Priority** — the discount and credit fields appear.
   *(Click **Non-Priority** to show they disappear, then **Priority** again.)*
4. Enter: discount `10` · credit period `2` · credit threshold `5000000` · category **Strategic**.
5. Click **Approve & activate**.

✅ **Activated**.
> *"Only the Director decides Priority, discount and credit. It applies to every future booking."*

**Track page:** reload https://nrc-ecargo-prototype.onrender.com/track?ref=REG-2026-0108 → ✅ **Activated**, "Approved — sign-in details were emailed".

**Mail tab:** **Switch mailbox** → **Harbour Link Logistics Ltd (new company)** → **Sign in**.
✅ A **Welcome** email with the **sign-in email** (the email typed at registration) and a **temporary password**. Keep this open — you need the password next.
*(Optional: switch to **Managing Director** — she has a copy of every step so far.)*

## A5. First sign-in: set a new password
1. Main tab: **Sign out**.
2. Under **Cargo facilitators** click **Harbour Link Logistics Ltd (Priority, new)** — the company's **email address** fills in as the sign-in name.
3. Type the **temporary password** from the welcome email → **Sign in**.
4. The **Set your password** page opens:
   - **Current (temporary) password** → the temporary password
   - **New password** → `Harbour2026`
   - **Confirm new password** → `Harbour2026`
   - Click **Set password and continue**.
5. You are back on the sign-in page with a green message and the email filled in. Type `Harbour2026` → **Sign in**.

✅ Harbour Link's own dashboard.
> *"A new customer never keeps the temporary password — they must set their own before using the platform."*

*(Mail tab: Harbour Link's mailbox now also has a **Password changed** security email.)*

## A6. The company books
1. Open https://nrc-ecargo-prototype.onrender.com/bookings/new and fill in:

| Field | Value |
|---|---|
| Booking date | `12 Nov 2026` |
| Cargo type | **Containerized** |
| Route | **Apapa Port → Ebute Metta (14 km)** |
| Container line | choose **20ft** from the dropdown, quantity `2` |
| Total weight (tons) | `38` |
| Commodity type | `Packaged beverages` |
| Hazardous cargo | **No** |

2. Point at the right-hand side: **no price yet** — it appears only after the container type is chosen. Then: **₦177,795.00** (10% discount, indicative).
3. **Next** → **Use sample file** on **Bill of Lading**, **Packing List** and **Invoice** → **Next**.
4. Tick **I confirm compliance with NRC Fair Cargo Policy…** → **Submit booking**.

✅ **NRC-BK-2026-0421** — **Pending Head of Cargo Review**.
> *"The price is instant. Nothing is paid until the booking is approved."*

## A7. Head of Cargo verifies
1. Sign in as **Head of Cargo**.
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-421
3. Click **Verified — forward to Director** → **Forward**.

✅ **Pending Director Review**.

## A8. Director approves and freezes the price
1. Sign in as **Director of Operations**.
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-421
3. **Final discount** → type `12` → click **Approve & freeze price**. ✅ Red message: the maximum is 10%.
4. Change it to `8`. **Reason** → `Promotional rate`. **Payment terms** → **Payment link now**.
5. Click **Approve & freeze price** → in the dialog click **Approve & freeze**.

✅ **Awaiting Payment** — price frozen at **₦181,746.00**.
> *"The Director can give less than the entitlement, never more, and must say why. Then the price is locked."*

## A9. The company pays
1. Sign in as the new company — click **Harbour Link Logistics Ltd (Priority, new)**, type `Harbour2026`.
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-421 → click **Pay now**.
3. Click **Pay via bank transfer** — the (demo) bank account and amount appear.
4. Click **Confirm payment** → spinner → green tick **Payment successful**.
5. Click **Back to booking**.

✅ **Pending Dispatch**. *(Refresh the page — the status stays.)*
> *"In production this is Paystack. An unpaid booking can never reach the port."*

## A10. Port checks the cargo and issues the AWB
1. Sign in as **Head of Port Operations**.
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-421
3. **Container photos** → click **Add sample photo** twice (they show a yellow **Not saved** tag), then click **Confirm photos**. ✅ They are saved and become a **view-only** record; the timeline gets one entry: "Container photos uploaded (2 photos; 2 on file)".
   *(Optional: to change something, the Head of Port re-uploads — **Add sample photo** → **Confirm re-upload** → "Container photos re-uploaded (1 new; 2 earlier kept; 3 on file)". Nothing is ever deleted.)*
4. **Physical verification & dispatch** → tick all **3** boxes.
5. **Train number** → pick `LI-FR-11`. ✅ Departure date, time and loading yard fill in by themselves.
6. **Wagon number** → `NRC-FW-30001`.
7. Click **Approve dispatch & generate AWB**.

✅ **AWB Generated** — note the AWB number.
> *"The port confirms the cargo, adds photos, and assigns train and wagon. An AWB is never issued twice."*

## A11. The company sees its AWB
1. Sign in as the new company (`Harbour2026`).
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-421
3. Show **Container photos** — click one to enlarge.
4. Click **View AWB** — QR code, train, wagon, departure.
5. Open https://nrc-ecargo-prototype.onrender.com/verify → type the AWB number → **Verify**. ✅ **Valid**.

**Mail tab:**
- **Harbour Link Logistics Ltd (new company)** → ✅ every stage: approval, payment, dispatch, AWB.
- **Sent mail (outbox)** (under *Platform*) → ✅ every email the system sent, and who got it.

---

# Journey B — A booking is rejected and the company is told

## B1. The company makes a second booking
1. Signed in as the new company, open https://nrc-ecargo-prototype.onrender.com/bookings/new
2. Same values as A6, except: Booking date `13 Nov 2026` · Commodity type `Used auto parts`.
3. Sample files → tick the box → **Submit booking**.

✅ **NRC-BK-2026-0422** — Pending Head of Cargo Review.

## B2. Head of Cargo rejects it
1. Sign in as **Head of Cargo**.
2. Open https://nrc-ecargo-prototype.onrender.com/bookings/bk-422
3. Click **Reject** → reason `Bill of Lading is for a different consignee` → **Reject booking**.

✅ **Rejected — Head of Cargo**. No payment was taken, so no refund is needed.
> *"A rejection always needs a reason, and the customer is told straight away."*

## B3. The company is notified
1. Sign in as the new company (`Harbour2026`).
2. Top bar **bell** → ✅ a new notification about the rejection. Click it.
3. ✅ The booking page shows **Rejected** with the reason at the top.

**Mail tab:** **Harbour Link Logistics Ltd (new company)** → ✅ the **rejection email** with the reason. *(Routine detail — container photos, remarks, pricing notes — is never emailed; only real stage changes are.)*
**Managing Director** → ✅ she was copied.

---

## Closing line
> *"Every step is recorded and every person is informed. Payments, emails, photos and documents are simulated here; the production system adds a secure backend, real sign-in, Paystack and real email."*

**If anything goes wrong:** do **Before you start** again, then restart from A2.
