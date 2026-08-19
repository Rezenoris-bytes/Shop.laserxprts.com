import type { MetadataRoute } from 'next';
import { demoMode, siteUrl } from '@/lib/site';

/**
 * robots.txt
 *
 * In DEMO_MODE everything is disallowed. The staging site carries invented
 * compatibility claims and placeholder prices under a real company's domain;
 * indexing it would put those in search results under the LEI brand.
 *
 * In production, faceted URLs are disallowed: category x brand x attributes x
 * sort x page generates tens of thousands of near-duplicate URLs and burns the
 * crawl budget that belongs to the product pages.
 */
export default function robots(): MetadataRoute.Robots {
  if (demoMode) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/search', '/quote-request', '/admin', '/api/', '/catalogue?*attr=*'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
