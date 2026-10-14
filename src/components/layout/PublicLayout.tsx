import type { ReactNode } from 'react'
import { LandingScope, PublicFooter, PublicHeader } from './PublicChrome'

/** Frame for simple public pages (e.g. AWB verification): solid header, content, footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <LandingScope>
      <a className="skip-link" href="#main">Skip to content</a>
      <PublicHeader pastHero />
      <main id="main" tabIndex={-1}>{children}</main>
      <PublicFooter />
    </LandingScope>
  )
}
