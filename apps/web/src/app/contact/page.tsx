import type { Metadata } from 'next';
import { canonical, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact Us | Get a Quote for Laser Spares & Consumables',
  description:
    'Contact Laser Experts India for genuine laser cutting machine spares, nozzles, protective windows, focus lenses and ceramic rings. Get a quick quote from our expert team.',
  keywords: ['contact laser experts india', 'laser parts enquiry', 'get laser parts quote', 'laser cutting spares support'],
  alternates: { canonical: canonical('/contact') },
  openGraph: {
    title: 'Contact Us | Laser Experts India',
    description: 'Get in touch with our team for genuine laser cutting machine spares and expert technical support. Quick response guaranteed.',
    url: canonical('/contact'),
    siteName,
    type: 'website',
    images: [{ url: `${siteUrl}/H.avif`, width: 1200, height: 630, alt: 'Laser Experts India — Contact Us' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | Laser Experts India',
    description: 'Get genuine laser cutting machine spares with expert technical support.',
    images: [`${siteUrl}/H.avif`],
  },
};

interface PageProps {
  searchParams: Promise<{ subject?: string }>;
}

export default async function ContactPage({ searchParams }: PageProps) {
  const { subject } = await searchParams;

  return (
    <div className="container-lei max-w-2xl py-12">
      <h1 className="text-2xl font-bold">Contact us</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Tell us what you need and our team will come back to you, usually within one working day.
      </p>

      {subject && (
        <div className="mt-5 rounded-card border border-amber/40 bg-amber-wash px-4 py-3 text-sm">
          Requesting: <span className="font-semibold">{subject}</span>
        </div>
      )}

      <div className="mt-8 card p-6">
        <p className="text-sm text-ink-muted">
          The contact form is delivered alongside the admin panel in the next stage. In the
          meantime, add the parts you need to a{' '}
          <a href="/catalogue" className="font-medium text-ink underline">
            Quote Request
          </a>{' '}
          — that reaches the same team.
        </p>
      </div>
    </div>
  );
}
