/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@lei/shared'],

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
