# Prompt — NRC e-Cargo landing page (standalone HTML)

Paste everything below the line into another Claude. Save its output as `landing.html`.

---

You are a senior product designer and front-end developer. Build the **public landing page** for the **NRC e-Cargo Operations Platform** — a digital platform for the Nigerian Railway Corporation (NRC) where cargo facilitators register their company, book rail cargo, get approvals, pay, and receive an Air Waybill (AWB). It is currently a **stakeholder prototype**, so the page must look credible and professional, but must never claim anything that is not true.

## Deliverable
- **One self-contained file: `landing.html`.** Inline `<style>` and inline `<script>` only. No frameworks, no build step, no CDN, no web fonts, no external images. Use a system font stack. Illustrations must be inline SVG or CSS.
- Under ~60 KB. Opens by double-click in any browser.
- Mark each section with comments like `<!-- SECTION: hero -->` and define all colours/spacing as CSS variables on `:root`, so the page can later be ported into a React + Tailwind app with little effort.
- Before the code, write 3 lines stating your design direction. After the code, list anything you assumed.

## Visual direction
Restrained, authoritative, modern government/enterprise — think a national railway meets a fintech dashboard. Lots of whitespace, strong typographic hierarchy, confident deep green, subtle depth (thin borders, soft shadows). **Not** a generic template: no purple gradients, no stock-photo look, no emoji, no confetti/animation overload. Include one distinctive hero visual built in SVG (e.g. a stylised rail line with stations Apapa → Ebute Metta → Moniya, a train silhouette, and a floating “booking card” showing a price breakdown and status chips). Motion: subtle only (hover, reveal on scroll); respect `prefers-reduced-motion`.

Palette (use exactly):
- brand-900 `#04301f`, brand-800 `#064531`, brand-700 `#08583f`, brand-600 `#0b6e4f`, brand-500 `#13865c`, brand-200 `#a9d8c1`, brand-100 `#d5ece0`, brand-50 `#eef7f2`
- surface `#f6f7f9`, white, slate scale for text (`#0f172a`, `#334155`, `#64748b`, `#e2e8f0`)
- status: emerald `#047857` on `#ecfdf5`, amber `#92400e` on `#fffbeb`, red `#b91c1c` on `#fef2f2`, sky `#075985` on `#f0f9ff`, slate `#475569` on `#e2e8f0`
- Body 16px, line-height 1.6; headings tight tracking. Meet WCAG AA contrast.

## Page structure (in this order)
1. **Prototype banner** (amber, thin): “Prototype — a demonstration of the NRC e-Cargo platform. Data is simulated and stored only in your browser.”
2. **Header** (sticky): logo mark (simple SVG train) + “NRC e-Cargo / Cargo Operations Platform”; links Services · How it works · Train availability · FAQ · Verify an AWB; primary button “Open the platform”. Mobile: accessible hamburger menu (button, `aria-expanded`).
3. **Hero** (dark green): eyebrow “Nigerian Railway Corporation”; H1 “Book rail cargo online — from registration to Air Waybill.”; one supporting sentence; buttons **Register your company** (primary, white) → `/register`, **Open the demo platform** (outline) → `/dashboard`, text link **Verify an AWB** → `/verify`; small note “No login in this prototype — a role switcher lets you view the platform as each NRC role or as a customer.” + the SVG visual.
4. **At a glance strip** — only these true facts: “8-stage journey, registration to AWB” · “2 districts: Lagos and Ibadan” · “Payment only after approval” · “Every action audit-logged”.
5. **Services** — 4 cards with inline SVG icons: Digital onboarding (company registers online; District Supervisor verifies documents; Director of Operations activates the account) · Capacity-linked booking (choose route and date, see slot availability, live price breakdown before submitting) · Clear payment terms (pay only after approval; eligible customers may be offered credit terms set by NRC) · AWB with QR verification (issued after physical verification and dispatch approval; a forged number fails the check).
6. **How it works** — horizontal stepper (vertical on mobile), 8 steps: Register → District verification → Director approval → Book cargo → Cargo & Director review → Pay or credit → Port verification → AWB issued. One short line under each.
7. **Priority vs Non-Priority** — a clean comparison table: Discount (Priority: up to an NRC-assigned maximum · Non-Priority: none) · Credit (up to an assigned period · none) · Payment options (pay now, or after the credit period · pay now only) · Price breakdown (shows a discount line · no discount line). Caption: “Priority is a status NRC assigns at registration, not a separate login.”
8. **Transparent pricing (illustrative)** — two side-by-side price cards using this worked example (label it “Illustrative example”): Base freight ₦180,000.00. **Priority (10% eligible discount):** discount −₦18,000.00 → net ₦162,000.00 → VAT 7.5% ₦12,150.00 → stamp duty 0.75% ₦1,215.00 → goods-in-transit insurance 1.5% ₦2,430.00 → **total ₦177,795.00**. **Non-Priority:** VAT ₦13,500.00 → stamp duty ₦1,350.00 → insurance ₦2,700.00 → **total ₦197,550.00**. Footnote: “Taxes shown on net freight (after discount); the basis is pending NRC confirmation. Rates are demo values, not NRC tariffs.”
9. **Train availability — next 7 days** (simulated) — a table: rows = Apapa Port → Apapa Local, Apapa Port → Ebute Metta, Apapa Port → Moniya (Ibadan); columns = the next 7 days generated by JS from today’s date. Cells are coloured chips: Open (emerald), Limited (amber), Full (red), Blocked (slate). Use a deterministic pattern, and make the **30 Oct** Ebute Metta cell and the **3 Nov** Moniya cell “Blocked” when they fall in range. Legend + caption “Simulated from demo capacity settings; the capacity rule is pending NRC confirmation.” On mobile the table scrolls horizontally inside its own container (the page must not scroll sideways).
10. **Governance** — 4 ticked points: Business authority (NRC) and platform authority (service provider) are separate · Every approval, rejection and change is recorded with who, when and why · Prices are frozen at Director approval and never silently changed · Refunds need two parties: the Director triggers, Super Admin executes.
11. **NRC Fair Cargo Policy** — a dashed-border **placeholder card**: “The policy highlights will be supplied by NRC.” and the declaration customers must accept when booking: “I confirm compliance with NRC Fair Cargo Policy.” Show a small amber note “Placeholder — no policy wording has been provided.”
12. **FAQ** — native `<details>/<summary>` accordion, 6 items:
   - Who can register? (CAC number, CAC certificate, company profile; tax certificate may be requested; choose district Lagos or Ibadan.)
   - When do I pay? (After the Director of Operations approves — never when you submit; by payment link, or after an NRC-approved credit period.)
   - What are Priority and Non-Priority customers? (status assigned by NRC; see table.)
   - What if my cargo fails the physical check? (booking cancelled, slot released; if already paid the Director triggers a refund, you submit a request, Super Admin processes it.)
   - What is an AWB? (unique number + QR; if details change a new version is issued and the earlier one is marked superseded.)
   - Is this the live system? (No — prototype; payments, emails, refunds simulated; all data fictional, in your browser.)
13. **Contact Cargo Operations** — placeholder block: “Demonstration contact — not a monitored address.” `cargo.operations@nrc.demo`.
14. **Footer** — “NRC e-Cargo prototype · All names, amounts and documents are fictional demonstration data · No real payments, emails or integrations.” plus links.

## Link targets (relative, keep exactly)
`/dashboard` (platform), `/register` (registration form), `/verify` (AWB verification), in-page anchors `#services #how #availability #faq #contact`.

## Hard rules — do NOT
- Invent statistics, customer counts, testimonials, awards, partner logos, phone numbers, addresses, social links, certifications, or NRC policy text. Where content is unknown, use the placeholders specified above.
- Use the real NRC logo or crest. Use a simple generic train mark.
- Use external requests of any kind (fonts, icons, images, analytics, scripts).
- Claim real payments, real Paystack processing, or real integrations.

## Quality bar
- Mobile-first; verify at 375, 768 and 1280 px; no horizontal page scroll at 375.
- Semantic landmarks (`header`, `nav`, `main`, `section` with headings, `footer`), a “Skip to content” link, visible `:focus-visible` rings, buttons are `<button>`/links are `<a>`, `aria-label`s on icon-only controls, all SVGs decorative (`aria-hidden`) or titled.
- Keyboard-operable menu and FAQ. No layout shift on load.
- Clean, commented, consistently indented code; CSS in logical blocks (tokens, base, layout, components, sections, responsive, reduced-motion).
- Self-check against this list before answering and fix anything that fails.
