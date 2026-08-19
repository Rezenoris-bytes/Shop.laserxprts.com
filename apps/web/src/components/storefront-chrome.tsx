'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { QuoteRequestDrawer } from './quote-request-drawer';
import { DemoBanner } from './demo-banner';

/**
 * Gates the storefront chrome (header, footer, Quote Request drawer, demo
 * banner) out of `/admin/*`.
 *
 * The admin panel is an internal tool with its own shell layout
 * (app/admin/(shell)/layout.tsx) — it has no Quote Request basket and no SEO
 * surface, so the public header/footer showing around a login screen or a
 * product-edit form is a real defect, not a stylistic choice. Gated here
 * rather than by restructuring every storefront page into a route group,
 * since the root layout is what unconditionally renders this chrome today.
 */
export function StorefrontChrome({
  demoMode,
  children,
}: {
  demoMode: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      {demoMode && <DemoBanner />}
      <SiteHeader />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                   focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <QuoteRequestDrawer />
    </>
  );
}
