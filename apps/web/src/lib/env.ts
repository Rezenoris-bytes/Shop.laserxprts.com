import { z } from 'zod';

/**
 * Build-time env validation.
 *
 * NEXT_PUBLIC_* vars are inlined into the bundle by Next's compiler at build
 * time — if they're missing when `next build` runs, the shipped JS silently
 * falls back to localhost. `next build` always sets NODE_ENV=production
 * internally regardless of target, so that alone can't distinguish "a real
 * production deploy forgot to set this" from "a local/CI build without full
 * env vars" — hard-failing on it would break every ordinary local build.
 * Instead this warns loudly (visible in the deploy workflow's build log) so
 * a misconfigured production build is obvious without breaking local ones.
 */
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function readEnv() {
  const parsed = schema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  const apiUrl = (parsed.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
  const siteUrl = (parsed.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  })) {
    const { hostname, protocol } = new URL(value);
    if (!isLocalHostname(hostname) && protocol !== 'https:') {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠ ${key} points at a non-local host over ${protocol.replace(':', '')} ("${value}"). ` +
          'If this is a production build, set it to an https:// URL.',
      );
    }
  }

  return { apiUrl, siteUrl };
}

export const env = readEnv();
