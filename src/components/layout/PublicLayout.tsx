import type { ReactNode } from 'react'
import { LandingScope, PublicFooter, PublicHeader } from './PublicChrome'

/** Frame for simple public pages (e.g. AWB verification): solid header, content, footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <LandingScope>
      {/* Full-height column so the footer always sits at the bottom of the screen, whatever the page length. */}
      <div className="flex min-h-dvh flex-col">
        <a className="skip-link" href="#main">Skip to content</a>
        <PublicHeader pastHero />
        <main id="main" tabIndex={-1} className="w-full flex-1 pt-4">{children}</main>
        <PublicFooter />
      </div>
    </LandingScope>
  )
}
