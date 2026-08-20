'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CategoryNode, Facet } from '@/lib/api';

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

  const activeCount = activeAttrs.length + ['category', 'brand', 'inStock'].filter((key) => params.get(key)).length;

  const flatCategories: Array<{ slug: string; label: string; count: number }> = [];
  const walk = (nodes: CategoryNode[], depth = 0) => {
    for (const node of nodes) {
      flatCategories.push({
        slug: node.slug,
        label: `${'  '.repeat(depth)}${node.name}`,
        count: node.productCount,
      });
      if (node.children.length) walk(node.children, depth + 1);
    }
  };
  walk(categories);

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
        <ul className="space-y-1">
          {flatCategories.map((category) => {
            const active = params.get('category') === category.slug;
            return (
              <li key={category.slug}>
                <button
                  type="button"
                  onClick={() => setParam('category', active ? null : category.slug)}
                  aria-pressed={active}
                  className={[
                    'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                    active ? 'bg-ink text-white' : 'hover:bg-ink-wash',
                  ].join(' ')}
                >
                  <span dangerouslySetInnerHTML={{ __html: category.label }} />
                  <span className={active ? 'text-white/60' : 'text-ink-muted'}>{category.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={params.get('inStock') === 'true'}
            onChange={(event) => setParam('inStock', event.target.checked ? 'true' : null)}
            className="h-4 w-4 rounded border-ink-line"
          />
          In stock only
        </label>
      </FilterGroup>

      {facets.map((facet) => (
        <FilterGroup key={facet.slug} title={`${facet.name}${facet.unit ? ` (${facet.unit})` : ''}`}>
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

      <FilterGroup title="Sort">
        <label htmlFor="sort" className="sr-only">
          Sort products
        </label>
        <select
          id="sort"
          value={params.get('sort') ?? 'relevance'}
          onChange={(event) => setParam('sort', event.target.value === 'relevance' ? null : event.target.value)}
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
