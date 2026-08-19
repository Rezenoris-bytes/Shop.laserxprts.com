/**
 * Site-level configuration.
 *
 * The production domain is deferred, so nothing here is a literal — SITE_URL
 * drives canonicals, Open Graph, the sitemap and every absolute link.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const siteName = 'Laser Experts India';

export const siteTagline = 'Laser spares, consumables and technical services';

/** Canonicals are DERIVED. Storing absolute URLs rots them on any domain change. */
export const canonical = (path: string): string =>
  `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;

export const demoBannerText =
  'Demonstration environment — product, pricing and compatibility data is sample data ' +
  'and is not verified LEI information.';

/**
 * Top navigation follows LEI's business lines rather than the entity model.
 * Customers think "I need remanufacturing", not "I need a service record".
 */
export const primaryNav = [
  { label: 'Home', href: '/' },
  { label: 'Spares & Consumables', href: '/catalogue' },
  { label: 'Find Parts', href: '/compatibility' },
  { label: 'About LEI', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const popularSearches = ['Raytools Nozzle', 'Protective Window', 'Focus Lens', 'Ceramic Ring'];
