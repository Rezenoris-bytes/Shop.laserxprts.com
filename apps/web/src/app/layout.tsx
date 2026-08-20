import type { Metadata } from 'next';
import '@/styles/globals.css';
import { QuoteRequestProvider } from '@/lib/quote-request';
import { StorefrontChrome } from '@/components/storefront-chrome';
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
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  // DEMO_MODE also sets X-Robots-Tag at the server (next.config.mjs). The meta
  // tag alone is not enough — a header cannot be missed on a route someone
  // forgets to annotate.
  robots: demoMode ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_IN',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <QuoteRequestProvider>
          <StorefrontChrome demoMode={demoMode}>{children}</StorefrontChrome>
        </QuoteRequestProvider>
      </body>
    </html>
  );
}
