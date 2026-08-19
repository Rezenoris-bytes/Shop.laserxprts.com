import type { Metadata } from 'next';
import '@/styles/globals.css';
import { QuoteRequestProvider } from '@/lib/quote-request';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { QuoteRequestDrawer } from '@/components/quote-request-drawer';
import { DemoBanner } from '@/components/demo-banner';
import { demoMode, siteName, siteTagline, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s | ${siteName}`,
  },
  description:
    'Genuine laser spares and consumables for all major fiber laser cutting machines. ' +
    'Nozzles, protective windows, focus lenses and ceramic rings, matched to your machine.',
  // DEMO_MODE also sets X-Robots-Tag at the server (next.config.mjs). The meta
  // tag alone is not enough — a header cannot be missed on a route someone
  // forgets to annotate.
  robots: demoMode
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_IN',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col">
        <QuoteRequestProvider>
          {demoMode && <DemoBanner />}
          <SiteHeader />
          {/* Skip link — the first thing a keyboard user needs. */}
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
        </QuoteRequestProvider>
      </body>
    </html>
  );
}
