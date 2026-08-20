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
    // Product pages existed until the catalogue moved to inline rows. Anything
    // already linked or indexed at /products/<slug> is sent to the catalogue
    // rather than left on a 404; the fragment cannot be set from a redirect, so
    // this lands on the listing rather than the exact row.
    return [
      { source: '/products/:slug', destination: '/catalogue', permanent: true },
      { source: '/products', destination: '/catalogue', permanent: true },
    ];
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
