'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Facet } from '@/lib/api';

/**
 * Renders the applied filter chips and the sort dropdown on mobile.
 * Displayed at the top of the product list.
 */
export function MobileCatalogueControls({ facets }: { facets: Facet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeAttrs = params.getAll('attr');
  const activeCount =
    activeAttrs.length + (params.get('brand') ? 1 : 0);

  const push = (next: URLSearchParams) => {
    next.delete('page');
    router.push(`${pathname}${next.size ? `?${next}` : ''}`);
  };

  const removeAttr = (token: string) => {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll('attr');
    next.delete('attr');
    for (const entry of current) {
      if (entry !== token) next.append('attr', entry);
    }
    push(next);
  };

  const clearAll = () => {
    // We only clear filters. `category` and `sort` are kept.
    const next = new URLSearchParams();
    const category = params.get('category');
    const sort = params.get('sort');
    if (category) next.set('category', category);
    if (sort) next.set('sort', sort);
    push(next);
  };

  const setSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'relevance') next.delete('sort');
    else next.set('sort', value);
    push(next);
  };

  if (activeCount === 0 && !params.get('sort')) {
    // If absolutely nothing is applied, we can still show just the sort box,
    // or return just the sort box. The mockup showed active filters. Let's just
    // return the Sort dropdown at minimum.
  }

  return (
    <div className="mb-6 block space-y-4 lg:hidden">
      {/* Active Filters Box */}
      {activeCount > 0 && (
        <div className="rounded-xl border border-ink-line bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4h14M5 10h10M8 16h4" strokeLinecap="round" />
              </svg>
              Filters ({activeCount})
            </h2>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-amber-dark transition-colors hover:text-amber"
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeAttrs.map((attr) => {
              const [slug, value] = attr.split(':');
              const facet = facets.find((f) => f.slug === slug);
              return (
                <button
                  key={attr}
                  type="button"
                  onClick={() => removeAttr(attr)}
                  className="flex items-center gap-1.5 rounded bg-amber-wash px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-amber-wash/70"
                >
                  <span className="text-ink-muted">{facet?.name ?? slug}:</span>
                  {value}
                  <svg className="ml-0.5 h-3 w-3 text-ink-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              );
            })}

            {params.get('brand') && (
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  next.delete('brand');
                  push(next);
                }}
                className="flex items-center gap-1.5 rounded bg-amber-wash px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-amber-wash/70"
              >
                <span className="text-ink-muted">Brand:</span>
                {params.get('brand')}
                <svg className="ml-0.5 h-3 w-3 text-ink-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sort Dropdown */}
      <div>
        <label htmlFor="mobile-sort" className="mb-1.5 block text-xs font-semibold text-ink-muted">
          Sort by
        </label>
        <select
          id="mobile-sort"
          value={params.get('sort') ?? 'relevance'}
          onChange={(e) => setSort(e.target.value)}
          className="field text-sm"
        >
          <option value="relevance">Most relevant</option>
          <option value="name_asc">Name A–Z</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
    </div>
  );
}
