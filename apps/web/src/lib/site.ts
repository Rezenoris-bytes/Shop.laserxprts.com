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

/** Business contact & trust details — shown in the identity bar. */
export const businessPhone = '+91 89258 42285';
export const businessEmail = 'business@laserxprts.com';
export const businessLocation = 'Hosur, Tamil Nadu';
export const businessGst = '33XXXXX0000X1ZX';

/** Full registered head office address. */
export const businessAddress = {
  line1: '27/3, Anumepally to Begapalli Road',
  line2: 'Zuzuvadi, Hosur – 635126',
  state: 'Tamil Nadu, India',
};

export type OfficeType = 'head-office' | 'branch' | 'service-hub';

export interface Office {
  city: string;
  label: string;
  type: OfficeType;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
}

/** All LEI offices and service hubs. */
export const offices: Office[] = [
  {
    city: 'Hosur',
    label: 'Head Office — Hosur',
    type: 'head-office',
    address: '27/3, Anumepally, Zuzuvadi, Hosur, Krishnagiri, Tamil Nadu 635126',
    lat: 12.7259,
    lng: 77.8281,
    mapsUrl: 'https://maps.google.com/?q=Laser+Experts+India+LLP+Zuzuvadi+Hosur+635126',
  },
  {
    city: 'Chennai',
    label: 'Branch — Chennai',
    type: 'branch',
    address:
      'Plot No 408, Gandhi Street, Gnanamoorthy Nagar Extension, Ambattur, Pattravakam, Chennai 600053',
    lat: 13.1143,
    lng: 80.1548,
    mapsUrl: 'https://maps.google.com/?q=Ambattur+Pattravakam+Chennai+600053',
  },
  {
    city: 'Coimbatore',
    label: 'Branch — Coimbatore',
    type: 'branch',
    address: 'RC Garden, 214/5A, Anjugam Nagar, Chinnavedampatti, Coimbatore, Tamil Nadu 641049',
    lat: 11.059,
    lng: 76.9558,
    mapsUrl: 'https://maps.google.com/?q=Chinnavedampatti+Coimbatore+641049',
  },
  {
    city: 'Pune',
    label: 'Branch — Pune',
    type: 'branch',
    address:
      'Building No 8, Flat No 002, AddressOne, Mamurdi, Gahunje, Dehu Road, Maharashtra 412101',
    lat: 18.652,
    lng: 73.72,
    mapsUrl: 'https://maps.google.com/?q=Mamurdi+Gahunje+Dehu+Road+Pune+412101',
  },
  {
    city: 'Delhi NCR',
    label: 'Branch — Delhi NCR',
    type: 'branch',
    address: '8th Floor, 801, Paras Trinity, Sector 63, Gurugram, Haryana 122002',
    lat: 28.4363,
    lng: 77.0631,
    mapsUrl: 'https://maps.google.com/?q=Paras+Trinity+Sector+63+Gurugram+122002',
  },
  {
    city: 'Bengaluru',
    label: 'Service Hub — Bengaluru',
    type: 'service-hub',
    address: 'Remote services and on-site support for clients in Bengaluru.',
    lat: 12.9716,
    lng: 77.5946,
    mapsUrl: 'https://maps.google.com/?q=Bengaluru',
  },
  {
    city: 'Hyderabad',
    label: 'Service Hub — Hyderabad',
    type: 'service-hub',
    address: 'Remote services and on-site support for clients in Hyderabad.',
    lat: 17.385,
    lng: 78.4867,
    mapsUrl: 'https://maps.google.com/?q=Hyderabad',
  },
];

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
  { label: 'Contact', href: '/contact' },
];

export const popularSearches = [
  'Raytools Nozzle',
  'Protective Window',
  'Focus Lens',
  'Ceramic Ring',
];
