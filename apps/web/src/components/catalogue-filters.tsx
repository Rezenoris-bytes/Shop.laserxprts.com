'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CategoryNode, Facet } from '@/lib/api';
import { FAMILY_VIEW_CATEGORIES } from '@/lib/nozzle-family';

/**
 * Catalogue filters.
 *
 * Attribute filters are encoded as `attr=slug:value`, and numeric ones support
 * `attr=slug:1.0..3.0`. The range form matters: the most useful filters in a
 * technical parts catalogue are numeric, and the API compares them against
 * valueDecimal rather than the text column — comparing "10.0" to "3.0" as text
 * puts a 10 mm nozzle inside a 1–3 mm filter.
 */
export function CatalogueFilters({
  facets,
  categories,
}: {
  facets: Facet[];
  categories: CategoryNode[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeAttrs = params.getAll('attr');

  const push = (next: URLSearchParams) => {
    next.delete('page');
    router.push(`${pathname}${next.size ? `?${next}` : ''}`);
  };

  const toggleAttr = (slug: string, value: string) => {
    const token = `${slug}:${value}`;
    const next = new URLSearchParams(params.toString());
    const current = next.getAll('attr');
    next.delete('attr');
    const updated = current.includes(token)
      ? current.filter((entry) => entry !== token)
      : [...current, token];
    for (const entry of updated) next.append('attr', entry);
    push(next);
  };

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    push(next);
  };

  const activeCount =
    activeAttrs.length + ['category', 'brand', 'inStock'].filter((key) => params.get(key)).length;

  // A catalogue-wide view has ~50 attribute groups behind it, because the
  // attribute set is the union of every category's. Rendering them all buries
  // sort and availability under a mile of chips nobody scrolls. Narrowing to a
  // category cuts it to a handful, so the rest stay one click away instead.
  const FACET_LIMIT = 8;
  const [showAllFacets, setShowAllFacets] = useState(false);
  const visibleFacets = showAllFacets ? facets : facets.slice(0, FACET_LIMIT);
  const hiddenFacetCount = facets.length - visibleFacets.length;

  return (
    <div className="space-y-6">
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-xs font-medium text-ink-muted underline hover:text-ink"
        >
          Clear all filters ({activeCount})
        </button>
      )}

      <FilterGroup title="Category">
        <CategoryAccordion
          categories={categories}
          activeSlug={params.get('category')}
          onSelect={(slug) => setParam('category', slug)}
        />
      </FilterGroup>



      {visibleFacets.map((facet) => (
        <FilterGroup
          key={facet.slug}
          title={`${facet.name}${facet.unit ? ` (${facet.unit})` : ''}`}
        >
          <div className="flex flex-wrap gap-1.5">
            {facet.values.slice(0, 14).map((value) => {
              const active = activeAttrs.includes(`${facet.slug}:${value}`);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleAttr(facet.slug, value)}
                  aria-pressed={active}
                  className={[
                    'rounded border px-2 py-1 text-xs font-medium',
                    active ? 'border-ink bg-ink text-white' : 'border-ink-line hover:border-ink',
                  ].join(' ')}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      ))}

      {hiddenFacetCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllFacets(true)}
          className="text-xs font-medium text-amber-dark underline"
        >
          Show {hiddenFacetCount} more filters
        </button>
      )}

      {showAllFacets && facets.length > FACET_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAllFacets(false)}
          className="text-xs font-medium text-ink-muted underline hover:text-ink"
        >
          Show fewer filters
        </button>
      )}

      <FilterGroup title="Sort">
        <label htmlFor="sort" className="sr-only">
          Sort products
        </label>
        <select
          id="sort"
          value={params.get('sort') ?? 'relevance'}
          onChange={(event) =>
            setParam('sort', event.target.value === 'relevance' ? null : event.target.value)
          }
          className="field text-sm"
        >
          <option value="relevance">Most relevant</option>
          <option value="name_asc">Name A–Z</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest first</option>
        </select>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Category accordion.
 *
 * One collapsible panel per top-level category, showing its product count and,
 * when open, a preview of what is inside. The preview is the point: a count
 * alone tells a customer how many nozzles exist, not whether the one they need
 * is among them, so they open the category to find out and pay a page load for
 * the answer.
 *
 * The header selects the category as a filter — that is what this control is
 * for — while the chevron expands the preview without changing the results, so
 * looking is free and filtering is deliberate.
 */
function CategoryAccordion({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: CategoryNode[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  // The tree arrives over the network and is ISR-cached for an hour, so a
  // payload written before `products` existed can outlive the deploy that
  // added it. TypeScript cannot see across that boundary — without these
  // fallbacks a stale cache entry takes the whole catalogue page down with it.
  const childrenOf = (node: CategoryNode) => node.children ?? [];
  // Empty for a family-view category: those show grouped family cards, not
  // one row per DB product, so a raw product-name quick-link here would
  // re-expose e.g. "Amada Single Layer Cutting Nozzle" as its own clickable
  // item next to the merged "Amada Cutting Nozzle" family card. The "View
  // more" link below still appears (product count is unaffected) and sends
  // the visitor straight to the grouped view instead.
  const productsOf = (node: CategoryNode) =>
    FAMILY_VIEW_CATEGORIES.has(node.slug) ? [] : (node.products ?? []);

  const containsActive = (node: CategoryNode): boolean =>
    node.slug === activeSlug || childrenOf(node).some(containsActive);

  // Null means "nothing opened by hand" — fall back to whichever panel holds
  // the active filter, so arriving on /catalogue?category=… lands with the
  // relevant panel already open.
  const [openedSlug, setOpenedSlug] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {categories.map((category) => {
        const active = category.slug === activeSlug;
        const open = openedSlug === null ? containsActive(category) : openedSlug === category.slug;

        return (
          <li
            key={category.slug}
            className={[
              'overflow-hidden rounded border',
              open ? 'border-ink-line bg-ink-wash' : 'border-ink-line bg-white',
            ].join(' ')}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => onSelect(active ? null : category.slug)}
                aria-pressed={active}
                className={[
                  'flex-1 px-3 py-2.5 text-left text-sm font-medium',
                  active ? 'text-amber-dark' : 'hover:text-amber-dark',
                ].join(' ')}
              >
                {category.name}{' '}
                <span className="font-normal text-ink-muted">({category.productCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenedSlug(open ? '' : category.slug)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name}`}
                className="px-3 text-ink-muted hover:text-ink"
              >
                <Chevron open={open} />
              </button>
            </div>

            {open && (
              <div className="px-3 pb-2.5">
                {childrenOf(category).map((child) => (
                  <button
                    key={child.slug}
                    type="button"
                    onClick={() => onSelect(child.slug === activeSlug ? null : child.slug)}
                    aria-pressed={child.slug === activeSlug}
                    className={[
                      'flex w-full items-center justify-between gap-2 border-t border-ink-line py-2 text-left text-[13px]',
                      child.slug === activeSlug
                        ? 'font-medium text-amber-dark'
                        : 'hover:text-amber-dark',
                    ].join(' ')}
                  >
                    <span>{child.name}</span>
                    <span className="text-ink-muted">({child.productCount})</span>
                  </button>
                ))}

                {productsOf(category).map((product) => (
                  <Link
                    key={product.slug}
                    href={`/catalogue?category=${category.slug}#${product.slug}`}
                    className="block border-t border-ink-line py-2 text-[13px] leading-snug text-ink-muted hover:text-amber-dark"
                  >
                    {product.name}
                  </Link>
                ))}

                {category.productCount > productsOf(category).length && (
                  <button
                    type="button"
                    onClick={() => onSelect(category.slug)}
                    className="mt-1 border-t border-ink-line pt-2 text-[13px] font-medium text-amber-dark underline"
                  >
                    View more
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
