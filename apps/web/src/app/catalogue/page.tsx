import Link from 'next/link';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { canonical } from '@/lib/site';
import { ProductCardTile } from '@/components/product-card';
import { CatalogueFilters } from '@/components/catalogue-filters';
import { Pagination } from '@/components/pagination';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : undefined;

  if (category) {
    try {
      const detail = await api.category(category);
      return {
        title: detail.metaTitle ?? detail.name,
        description: detail.metaDescription ?? undefined,
        alternates: { canonical: canonical(`/catalogue?category=${category}`) },
      };
    } catch {
      // Fall through to the generic listing metadata.
    }
  }

  return {
    title: 'Spares & consumables',
    description: 'Browse laser spares and consumables by category, brand and machine compatibility.',
    alternates: { canonical: canonical('/catalogue') },
    // Multi-facet combinations generate a very large URL space over nearly
    // identical content. Only the bare listing and single-category views are
    // indexable; everything else is follow-but-noindex.
    robots: hasMultipleFacets(params) ? { index: false, follow: true } : undefined,
  };
}

function hasMultipleFacets(params: Record<string, string | string[] | undefined>): boolean {
  const facetKeys = ['brand', 'machineModel', 'machineBrand', 'attr', 'minPrice', 'maxPrice', 'inStock'];
  return facetKeys.filter((key) => params[key] !== undefined).length > 0;
}

export default async function CataloguePage({ searchParams }: PageProps) {
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };

  const attrParams = Array.isArray(params.attr)
    ? params.attr
    : params.attr
      ? [params.attr]
      : [];

  const query: Record<string, string | number | undefined> = {
    page: Number(single('page') ?? 1),
    perPage: 24,
    category: single('category'),
    brand: single('brand'),
    machineModel: single('machineModel'),
    machineBrand: single('machineBrand'),
    sort: single('sort') ?? 'relevance',
    inStock: single('inStock'),
  };

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  for (const attr of attrParams) search.append('attr', attr);

  const [{ data: products, meta }, facets, categories] = await Promise.all([
    fetchProducts(search),
    api.facets(single('category')),
    api.categories(),
  ]);

  const activeCategory = single('category')
    ? await api.category(single('category')!).catch(() => null)
    : null;

  return (
    <div className="container-lei py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            {activeCategory ? (
              <Link href="/catalogue" className="hover:text-ink">
                Catalogue
              </Link>
            ) : (
              <span className="text-ink">Catalogue</span>
            )}
          </li>
          {activeCategory && (
            <>
              <li aria-hidden>/</li>
              <li className="text-ink">{activeCategory.name}</li>
            </>
          )}
        </ol>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{activeCategory?.name ?? 'Spares & consumables'}</h1>
        {activeCategory?.description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {activeCategory.description}
          </p>
        )}
        <p className="mt-2 text-sm text-ink-muted">
          {meta.pagination.total} {meta.pagination.total === 1 ? 'product' : 'products'}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <CatalogueFilters facets={facets} categories={categories} />
        </aside>

        <div>
          {products.length === 0 ? (
            <NoResults />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCardTile key={product.id} product={product} />
                ))}
              </div>
              <Pagination meta={meta.pagination} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function fetchProducts(search: URLSearchParams) {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const response = await fetch(`${base}/api/v1/products?${search.toString()}`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    return { data: [], meta: { pagination: { page: 1, perPage: 24, total: 0, totalPages: 1, hasNext: false, hasPrev: false } } };
  }
  return (await response.json()) as Awaited<ReturnType<typeof api.productsWithMeta>>;
}

/**
 * A customer who filtered too hard is not a dead end — they are a qualified
 * lead. Offer the way back and the way to ask.
 */
function NoResults() {
  return (
    <div className="card px-6 py-14 text-center">
      <p className="text-base font-semibold">No products match these filters</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        Try removing a filter, or tell us what you are looking for — we source parts that are not
        listed.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/catalogue" className="btn-secondary text-sm">
          Clear all filters
        </Link>
        <Link href="/contact" className="btn-primary text-sm">
          Request a part
        </Link>
      </div>
    </div>
  );
}
