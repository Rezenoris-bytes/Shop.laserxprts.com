import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

// One source of truth for configuration. The API already reads the repo-root
// .env; Next only looks inside apps/web, so without this the two halves of the
// monorepo would need the same secret written twice and kept in step by hand.
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

// Product images are served by the API, whose origin is env-driven. Deriving
// the pattern from the same variable the client uses keeps the optimiser
// working across local, staging and production without a second setting to
// forget.
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@lei/shared'],

  images: {
    // Images are served straight from the API rather than proxied through
    // Next's optimiser. The optimiser requests every image at nine widths
    // (384w…3840w), which on shared hosting means thousands of requests for a
    // 150-product catalogue — enough to take the API down on a cold cache.
    // The source images are already web-sized (~1000px, 14–500KB) and the API
    // serves them content-addressed with immutable year-long cache headers, so
    // resizing them a second time bought little and cost a great deal.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: apiOrigin.protocol.replace(':', ''),
        hostname: apiOrigin.hostname,
        port: apiOrigin.port || undefined,
        pathname: '/uploads/**',
      },
    ],
  },

  async redirects() {
    // NOTE: /products/:slug used to redirect here, from when the catalogue
    // moved to inline rows. That redirect is gone because §9 and §30 of the
    // aftermarket specification require a real product page — it is the step
    // between discovery and enquiry, and it is where compatibility, related
    // parts and Enquire Now live. With the redirect in place all three were
    // unreachable code.
    //
    // The bare /products index still redirects: there is no index page, and
    // the catalogue is what it was always meant to show.
    return [{ source: '/products', destination: '/catalogue', permanent: true }];
  },

  async headers() {
    // DEMO_MODE blocks indexing at the SERVER, not just via meta tags. The
    // staging site sits on a subdomain of a real trading company's domain and
    // carries invented compatibility claims and placeholder prices; a header
    // cannot be missed the way a per-page meta tag can.
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ];

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      headers.push({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive, nosnippet',
      });
    }

    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
