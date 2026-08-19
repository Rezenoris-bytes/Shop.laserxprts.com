import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { canonical, demoMode } from '@/lib/site';

/**
 * Sitemap, generated from the database so lastmod is real.
 *
 * Returns empty in DEMO_MODE — submitting a sitemap of sample data would be
 * actively counterproductive.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (demoMode) return [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonical('/'), changeFrequency: 'weekly', priority: 1 },
    { url: canonical('/catalogue'), changeFrequency: 'daily', priority: 0.9 },
    { url: canonical('/compatibility'), changeFrequency: 'monthly', priority: 0.8 },
    { url: canonical('/about'), changeFrequency: 'yearly', priority: 0.3 },
    { url: canonical('/contact'), changeFrequency: 'yearly', priority: 0.5 },
  ];

  try {
    const [categories, products] = await Promise.all([
      api.categories(),
      api.products({ perPage: 100 }),
    ]);

    const flat: MetadataRoute.Sitemap = [];
    const walk = (nodes: Awaited<ReturnType<typeof api.categories>>) => {
      for (const node of nodes) {
        flat.push({
          url: canonical(`/catalogue?category=${node.slug}`),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
        if (node.children.length) walk(node.children);
      }
    };
    walk(categories);

    return [
      ...staticRoutes,
      ...flat,
      ...products.map((product) => ({
        url: canonical(`/products/${product.slug}`),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // A sitemap that 500s is worse than a small one.
    return staticRoutes;
  }
}
