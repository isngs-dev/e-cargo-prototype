import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Header, footer and wrapper shared by the public pages (landing, AWB verification).
 * Markup and classes come from the approved landing reference; styles live in features/landing/landing.css,
 * scoped under `.nrc-landing`.
 */

/** Scopes the landing styles and sets smooth anchor scrolling while a public page is shown. */
export function LandingScope({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('lp-smooth')
    return () => document.documentElement.classList.remove('lp-smooth')
  }, [])
  return (
    <div className="nrc-landing" id="top">
      <div className="js">{children}</div>
    </div>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="3" width="12" height="13" rx="3" /><path d="M6 9.5h12" /><path d="M9.5 13h.01M14.5 13h.01" /><path d="M8.5 16 6.5 21M15.5 16l2 5M7.5 19h9" />
      </svg>
    </span>
  )
}

function Brand() {
  return (
    <Link className="brand" to="/" onClick={() => window.scrollTo({ top: 0 })}>
      <BrandMark />
      <span className="brand-text"><span className="brand-name">NRC e-Cargo</span><span className="brand-sub">Cargo Operations Platform</span></span>
    </Link>
  )
}

/** `pastHero` makes the header solid; on the landing page it is transparent over the hero until the visitor scrolls past it. */
export function PublicHeader({ pastHero }: { pastHero: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    const wide = window.matchMedia('(min-width: 1100px)')
    const onWide = (e: MediaQueryListEvent) => e.matches && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [])

  return (
    <header className={`site-header${pastHero || menuOpen ? ' is-solid' : ''}`}>
      <div className="lp-container header-inner">
        <Brand />
        <button className="nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-nav" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
          <svg className="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <svg className="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <nav id="primary-nav" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Primary" onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}>
          <ul className="nav-list">
            <li><a href="/#services">Services</a></li>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/#availability">Train availability</a></li>
            <li><a href="/#faq">FAQ</a></li>
            <li><Link to="/verify">Verify an AWB</Link></li>
          </ul>
          <Link className="btn btn--primary nav-cta" to="/dashboard">Open the platform</Link>
        </nav>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="site-footer on-dark">
      <div className="scale-bar" aria-hidden="true" />
      <div className="lp-container footer-main">
        <div className="footer-top">
          <div>
            <Brand />
            <p className="footer-statement">NRC e-Cargo prototype · All names, amounts and documents are fictional demonstration data · No real payments, emails or integrations.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="footer-links">
              <li><Link to="/dashboard">Open the platform</Link></li>
              <li><a href="/#services">Services</a></li>
              <li><Link to="/register">Register your company</Link></li>
              <li><a href="/#how">How it works</a></li>
              <li><Link to="/verify">Verify an AWB</Link></li>
              <li><a href="/#availability">Train availability</a></li>
              <li><a href="/#faq">FAQ</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </nav>
        </div>
        <p className="footer-bottom">Prototype for stakeholder review. Not an official NRC website.</p>
      </div>
    </footer>
  )
}
