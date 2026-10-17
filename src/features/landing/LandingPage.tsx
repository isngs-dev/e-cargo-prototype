import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { useStore } from '@/app/store'
import { LandingScope, PublicFooter, PublicHeader } from '@/components/layout/PublicChrome'
import { availability, loadLevel, type LoadLevel } from '@/lib/capacity'
import { todayISO } from '@/lib/workflow/booking'
import { startHeroScene } from './heroScene'

/**
 * Public landing page. Design, copy and behaviour come from the approved reference (docs/landing-reference/landing.html);
 * what changed in the port: links are router links, "Register your company" switches to the demo applicant first, the
 * availability table reads the app's real capacity data, and the amber prototype banner was added.
 */

const CHIP: Record<LoadLevel, { cls: string; label: string }> = {
  open: { cls: 'chip--ok', label: 'Open' },
  limited: { cls: 'chip--warn', label: 'Limited' },
  full: { cls: 'chip--err', label: 'Full' },
  maintenance: { cls: 'chip--muted', label: 'Blocked' },
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Next 7 days per active route, from the same capacity and maintenance data the booking form uses. */
function AvailabilityTable() {
  const { data } = useStore()
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i))
  return (
    <table className="avail" id="availability-table">
      <thead>
        <tr>
          <th scope="col" className="route-col">Route</th>
          {days.map((d, i) => (
            <th key={iso(d)} scope="col" className={i === 0 ? 'is-today' : undefined}>
              <span className="day-name">{i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className="day-date">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.routes.filter((r) => r.active).map((r) => (
          <tr key={r.id}>
            <th scope="row" className="route-col"><span className="route-from">{r.origin.toUpperCase()} →</span><span className="route-to">{r.destination}</span></th>
            {days.map((d, i) => {
              const chip = CHIP[loadLevel(availability(data, r.id, iso(d)))]
              return <td key={iso(d)} className={i === 0 ? 'is-today' : undefined}><span className={`chip ${chip.cls}`}>{chip.label}</span></td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** "How it works": a runner travels the line from stage 1 to 8 while the section is on screen. */
function useLineAnimation(wrapRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const wrap = wrapRef.current
    const bar = wrap?.querySelector<HTMLElement>('.line-progress')
    if (!wrap || !bar) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stops = Array.from(wrap.querySelectorAll<HTMLElement>('.stop'))
    const dots = Array.from(wrap.querySelectorAll<HTMLElement>('.stop-dot'))
    let cur = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let visible = false
    let horiz = false
    let pts: [number, number][] = []

    const render = () => {
      if (!pts.length) return
      const first = pts[0]!
      const here = pts[cur]!
      const len = horiz ? here[0] - first[0] : here[1] - first[1]
      bar.style.width = horiz ? `${len}px` : '3px'
      bar.style.height = horiz ? '3px' : `${len}px`
      stops.forEach((s, i) => { s.classList.toggle('is-done', i <= cur); s.classList.toggle('is-current', i === cur) })
    }
    const measure = () => {
      const wb = wrap.getBoundingClientRect()
      pts = dots.map((d) => { const b = d.getBoundingClientRect(); return [b.left - wb.left + b.width / 2, b.top - wb.top + b.height / 2] as [number, number] })
      horiz = Math.abs(pts[1]![1] - pts[0]![1]) < 2
      bar.className = `line-progress ${horiz ? 'is-h' : 'is-v'}`
      bar.style.left = `${horiz ? pts[0]![0] : pts[0]![0] - 1.5}px`
      bar.style.top = `${horiz ? pts[0]![1] - 1.5 : pts[0]![1]}px`
      render()
    }
    const tick = () => {
      timer = undefined
      cur = cur >= stops.length - 1 ? 0 : cur + 1
      render()
      if (visible) timer = setTimeout(tick, cur === stops.length - 1 ? 2800 : 1200)
    }

    wrap.classList.add('is-animated')
    window.addEventListener('resize', measure)
    let io: IntersectionObserver | undefined
    if (reduce) {
      cur = stops.length - 1
      measure()
    } else {
      measure()
      io = new IntersectionObserver((entries) => {
        visible = !!entries[0]?.isIntersecting
        if (visible && !timer) timer = setTimeout(tick, 900)
        if (!visible && timer) { clearTimeout(timer); timer = undefined }
      }, { threshold: 0.3 })
      io.observe(wrap)
    }
    return () => {
      window.removeEventListener('resize', measure)
      io?.disconnect()
      if (timer) clearTimeout(timer)
      wrap.classList.remove('is-animated')
    }
  }, [wrapRef])
}

export function LandingPage() {
  const heroRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackerRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [pastHero, setPastHero] = useState(false)

  /** "Register your company" opens the registration form as the demo applicant. */

  useEffect(() => {
    const previous = document.title
    document.title = 'NRC e-Cargo — Cargo Operations Platform (Prototype)'
    return () => { document.title = previous }
  }, [])

  // header is transparent over the hero, solid after it
  useEffect(() => {
    const hero = heroRef.current
    if (!hero || !('IntersectionObserver' in window)) { setPastHero(true); return }
    const io = new IntersectionObserver((e) => setPastHero(!e[0]?.isIntersecting), { rootMargin: '-68px 0px 0px 0px' })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current, tracker = trackerRef.current
    if (!stage || !canvas || !tracker) return
    return startHeroScene(stage, canvas, tracker, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useLineAnimation(lineRef)

  // reveal on scroll
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.nrc-landing .reveal'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target) } })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <LandingScope>
      <a className="skip-link" href="#main">Skip to content</a>
      <PublicHeader pastHero={pastHero} />

      <main id="main" tabIndex={-1}>
          {/* SECTION: hero (canvas corridor view + copy) */}
          <section className="hero on-dark" aria-labelledby="hero-title" ref={heroRef}>
            <div className="hero-stage" aria-hidden="true" ref={stageRef}>
              <canvas ref={canvasRef} />
              <div className="hero-scrim"></div>
              <div className="tracker" id="tracker" ref={trackerRef}>
                <span className="tracker-eyebrow">Sample consignment · simulated</span>
                <span className="tracker-route">Apapa Port → Moniya (Ibadan)</span>
                <span className="tracker-meta"><span className="chip chip--ok">AWB issued</span><span className="tracker-awb">SAMPLE-0417</span></span>
              </div>
            </div>

            <div className="lp-container">
              <div className="hero-copy">
                <p className="hero-eyebrow">Nigerian Railway Corporation</p>
                <h1 id="hero-title">Book rail cargo online — from registration to Air Waybill.</h1>
                <p className="hero-lead">Register your company, book capacity on NRC freight trains, get approvals, pay and receive your Air Waybill — in one platform.</p>
                <div className="hero-actions">
                  <Link className="btn btn--light btn--lg" to="/register">Register your company</Link>
                  <Link className="btn btn--ghost btn--lg" to="/track">Track application</Link>
                  <Link className="hero-link" to="/verify">Verify an AWB
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </Link>
                </div>
              </div>
            </div>
            <div className="scale-bar" aria-hidden="true"></div>
          </section>

          {/* SECTION: at a glance */}
          <section className="glance" aria-labelledby="glance-title">
            <div className="lp-container">
              <h2 id="glance-title" className="sr-only">At a glance</h2>
              <ul className="glance-list reveal stagger">
                <li className="glance-item">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h10"/></svg></span>
                  <div><strong>8-stage journey</strong><span>Registration to AWB</span></div>
                </li>
                <li className="glance-item">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg></span>
                  <div><strong>2 districts</strong><span>Lagos and Ibadan</span></div>
                </li>
                <li className="glance-item">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M8 15h3"/></svg></span>
                  <div><strong>Payment only after approval</strong><span>Never at submission</span></div>
                </li>
                <li className="glance-item">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M10 11h5M10 15h5"/></svg></span>
                  <div><strong>Every action audit-logged</strong><span>Who, when and why</span></div>
                </li>
              </ul>
            </div>
          </section>

          {/* SECTION: services */}
          <section id="services" className="section" aria-labelledby="services-title">
            <div className="lp-container">
              <div className="section-head reveal">
                <p className="eyebrow"><span className="idx">01</span>Services</p>
                <h2 id="services-title">One platform, from onboarding to dispatch.</h2>
              </div>
              <div className="services reveal stagger">
                <article className="service">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-5h6v5M9 11h.01M12 11h.01M15 11h.01"/></svg></span>
                  <h3>Digital onboarding</h3>
                  <p>Your company registers online. A District Supervisor verifies the documents, then the Director of Operations activates the account.</p>
                </article>
                <article className="service">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7.5 14h3v3h-3zM13.5 14h3v3h-3z"/></svg></span>
                  <h3>Capacity-linked booking</h3>
                  <p>Choose a route and date, see slot availability, and review a live price breakdown before you submit.</p>
                </article>
                <article className="service">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/><path d="m14.5 15 1.6 1.5 3-3"/></svg></span>
                  <h3>Clear payment terms</h3>
                  <p>You pay only after your booking is approved. Eligible customers may be offered credit terms set by NRC.</p>
                </article>
                <article className="service">
                  <span className="icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M17 21h4v-4M14 21h.01"/></svg></span>
                  <h3>AWB with QR verification</h3>
                  <p>Issued after physical verification and dispatch approval. Check any AWB by QR code or number — a forged number fails the check.</p>
                </article>
              </div>
            </div>
          </section>

          {/* SECTION: how it works */}
          <section id="how" className="section section--surface" aria-labelledby="how-title">
            <div className="lp-container">
              <div className="section-head reveal">
                <p className="eyebrow"><span className="idx">02</span>How it works</p>
                <h2 id="how-title">Eight stages, registration to Air Waybill.</h2>
                <p>Every stage is recorded in the audit log, so a booking’s position is always clear.</p>
              </div>
              <div className="reveal line-wrap" ref={lineRef}>
                <div className="phases" aria-hidden="true"><span className="phase">Onboarding</span><span className="phase">Booking &amp; payment</span><span className="phase">Dispatch</span></div>
                <ol className="line">
                  <li className="stop"><span className="stop-dot" aria-hidden="true">01</span><h3>Register</h3><p>Submit company details and CAC documents online.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">02</span><h3>District verification</h3><p>A District Supervisor checks your documents.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">03</span><h3>Director approval</h3><p>The Director of Operations activates the account.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">04</span><h3>Book cargo</h3><p>Pick route, date and slot; see the price first.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">05</span><h3>Cargo &amp; Director review</h3><p>The booking is reviewed; the price freezes on approval.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">06</span><h3>Pay or credit</h3><p>Pay by link, or after an NRC-approved credit period.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">07</span><h3>Port verification</h3><p>Cargo is physically checked and dispatch approved.</p></li>
                  <li className="stop"><span className="stop-dot" aria-hidden="true">08</span><h3>AWB issued</h3><p>Air Waybill with a unique number and QR code.</p></li>
                </ol>
                <span className="line-progress" aria-hidden="true"><span className="line-runner"></span></span>
              </div>
            </div>
          </section>

          {/* SECTION: priority vs non-priority + transparent pricing */}
          <section id="pricing" className="section" aria-labelledby="pricing-title">
            <div className="lp-container">
              <div className="section-head reveal">
                <p className="eyebrow"><span className="idx">03</span>Status &amp; pricing</p>
                <h2 id="pricing-title">Priority and Non-Priority, priced in the open.</h2>
                <p>Every booking shows its full price breakdown before you submit.</p>
              </div>

              <div className="table-wrap reveal" id="priority">
                <table className="compare">
                  <caption>Priority is a status NRC assigns at registration, not a separate login.</caption>
                  <colgroup><col style={{ width: '30%' }} /><col className="col-p" style={{ width: '35%' }} /><col style={{ width: '35%' }} /></colgroup>
                  <thead><tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col" className="col-p">Priority</th><th scope="col">Non-Priority</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">Discount</th><td>Up to an NRC-assigned maximum</td><td className="is-none">None</td></tr>
                    <tr><th scope="row">Credit</th><td>Up to an assigned period</td><td className="is-none">None</td></tr>
                    <tr><th scope="row">Payment options</th><td>Pay now, or after the credit period</td><td>Pay now only</td></tr>
                    <tr><th scope="row">Price breakdown</th><td>Shows a discount line</td><td>No discount line</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-row reveal">
                <div className="pricing-intro">
                  <span className="chip chip--warn chip--plain">Illustrative example</span>
                  <h3>Same freight, both statuses</h3>
                  <p>Base freight ₦180,000.00. Taxes shown on net freight (after discount); the basis is pending NRC confirmation. Rates are demo values, not NRC tariffs.</p>
                </div>

                <article className="receipt receipt--p" aria-labelledby="r-p">
                  <div className="receipt-head"><h3 id="r-p">Priority</h3><span>10% eligible discount</span></div>
                  <dl>
                    <div className="rl"><dt>Base freight</dt><dd>₦180,000.00</dd></div>
                    <div className="rl rl--disc"><dt>Discount <span className="rate">10%</span></dt><dd>−₦18,000.00</dd></div>
                    <div className="rl rl--sub"><dt>Net freight</dt><dd>₦162,000.00</dd></div>
                    <div className="rl"><dt>VAT <span className="rate">7.5%</span></dt><dd>₦12,150.00</dd></div>
                    <div className="rl"><dt>Stamp duty <span className="rate">0.75%</span></dt><dd>₦1,215.00</dd></div>
                    <div className="rl"><dt>Goods-in-transit insurance <span className="rate">1.5%</span></dt><dd>₦2,430.00</dd></div>
                    <div className="rl rl--total"><dt>Total</dt><dd>₦177,795.00</dd></div>
                  </dl>
                </article>

                <article className="receipt" aria-labelledby="r-n">
                  <div className="receipt-head"><h3 id="r-n">Non-Priority</h3><span>No discount</span></div>
                  <dl>
                    <div className="rl"><dt>Base freight</dt><dd>₦180,000.00</dd></div>
                    <div className="rl"><dt>VAT <span className="rate">7.5%</span></dt><dd>₦13,500.00</dd></div>
                    <div className="rl"><dt>Stamp duty <span className="rate">0.75%</span></dt><dd>₦1,350.00</dd></div>
                    <div className="rl"><dt>Goods-in-transit insurance <span className="rate">1.5%</span></dt><dd>₦2,700.00</dd></div>
                    <div className="rl-gap" aria-hidden="true"></div>
                    <div className="rl rl--total"><dt>Total</dt><dd>₦197,550.00</dd></div>
                  </dl>
                </article>
              </div>
            </div>
          </section>

          {/* SECTION: train availability */}
          <section id="availability" className="section section--surface" aria-labelledby="availability-title">
            <div className="lp-container">
              <div className="section-head reveal">
                <p className="eyebrow"><span className="idx">04</span>Train availability</p>
                <div className="title-row"><h2 id="availability-title">Next 7 days</h2><span className="chip chip--muted chip--plain">Simulated</span></div>
              </div>
              <ul className="legend" aria-label="Legend">
                <li><span className="chip chip--ok">Open</span></li>
                <li><span className="chip chip--warn">Limited</span></li>
                <li><span className="chip chip--err">Full</span></li>
                <li><span className="chip chip--muted">Blocked</span></li>
              </ul>
              <div className="table-wrap" role="region" aria-labelledby="availability-title" tabIndex={0}>
                <AvailabilityTable />
              </div>
                    <p className="caption">Simulated from demo capacity settings; the capacity rule is pending NRC confirmation.</p>
            </div>
          </section>

          {/* SECTION: governance + NRC Fair Cargo Policy */}
          <section id="governance" className="section section--dark on-dark" aria-labelledby="governance-title">
            <div className="lp-container gov-layout">
              <div className="reveal">
                <div className="section-head">
                  <p className="eyebrow"><span className="idx">05</span>Governance</p>
                  <h2 id="governance-title">Accountable by design.</h2>
                </div>
                <ul className="gov-list">
                  <li><span className="tick" aria-hidden="true"></span><div><strong>Separate authorities</strong>Business authority (NRC) and platform authority (service provider) are separate.</div></li>
                  <li><span className="tick" aria-hidden="true"></span><div><strong>Complete audit trail</strong>Every approval, rejection and change is recorded with who, when and why.</div></li>
                  <li><span className="tick" aria-hidden="true"></span><div><strong>Frozen prices</strong>Prices are frozen at Director approval and never silently changed.</div></li>
                  <li><span className="tick" aria-hidden="true"></span><div><strong>Two-party refunds</strong>Refunds need two parties: the Director triggers, Super Admin executes.</div></li>
                </ul>
              </div>

              <div className="policy reveal" id="policy">
                <h3>NRC Fair Cargo Policy</h3>
                <p className="note note--warn">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M10 3 2.5 16.5h15z"/><path d="M10 8.5v3.5M10 14.5h.01"/></svg>
                  <span>Placeholder — no policy wording has been provided.</span>
                </p>
                <p className="policy-text">The policy highlights will be supplied by NRC.</p>
                <div className="declaration">
                  <span className="declaration-label">Declaration accepted at booking</span>
                  <p><span className="mock-check" aria-hidden="true"></span><span>I confirm compliance with NRC Fair Cargo Policy.</span></p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: faq + contact */}
          <section id="faq" className="section section--surface" aria-labelledby="faq-title">
            <div className="lp-container faq-layout">
              <div className="reveal">
                <div className="section-head">
                  <p className="eyebrow"><span className="idx">06</span>FAQ</p>
                  <h2 id="faq-title">Frequently asked questions</h2>
                </div>
                {/* SECTION: contact */}
                <div className="contact" id="contact">
                  <h3>Contact Cargo Operations</h3>
                  <p className="note note--warn">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M10 3 2.5 16.5h15z"/><path d="M10 8.5v3.5M10 14.5h.01"/></svg>
                    <span>Demonstration contact — not a monitored address.</span>
                  </p>
                  <span className="contact-email"><span className="sr-only">Email: </span>cargo.operations@nrc.demo</span>
                </div>
              </div>

              <div className="faq-list reveal">
                <details className="faq-item">
                  <summary>Who can register?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>Companies that provide a CAC number, a CAC certificate and a company profile. A tax certificate may also be requested. During registration you choose your district — Lagos or Ibadan.</p></div>
                </details>
                <details className="faq-item">
                  <summary>When do I pay?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>Only after the Director of Operations approves your booking — never when you submit it. You then pay by payment link, or after an NRC-approved credit period.</p></div>
                </details>
                <details className="faq-item">
                  <summary>What are Priority and Non-Priority customers?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>They are statuses NRC assigns to a company, not separate logins. The status determines discount, credit and payment options — see the <a href="#priority">comparison table</a>.</p></div>
                </details>
                <details className="faq-item">
                  <summary>What if my cargo fails the physical check?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>The booking is cancelled and its slot is released. If you have already paid, the Director triggers a refund, you submit a refund request, and Super Admin processes it.</p></div>
                </details>
                <details className="faq-item">
                  <summary>What is an AWB?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>The Air Waybill issued for your cargo, with a unique number and a QR code you can <Link to="/verify">verify</Link>. If details change, a new version is issued and the earlier one is marked superseded.</p></div>
                </details>
                <details className="faq-item">
                  <summary>Is this the live system?<span className="faq-chev" aria-hidden="true"></span></summary>
                  <div className="faq-body"><p>No. This is a prototype. Payments, emails and refunds are simulated, and all data is fictional and stored only in your browser.</p></div>
                </details>
              </div>
            </div>
          </section>
      </main>

      <PublicFooter />
    </LandingScope>
  )
}

