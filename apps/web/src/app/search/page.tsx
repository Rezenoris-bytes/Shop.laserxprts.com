import Link from 'next/link';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { popularSearches } from '@/lib/site';
import { ProductCardTile } from '@/components/product-card';
import { HeroSearch } from '@/components/hero-search';

export const metadata: Metadata = {
  title: 'Search',
  // Search results are genuinely dynamic and near-duplicate. Indexing them
  // burns crawl budget that belongs to the product pages.
  robots: { index: false, follow: true },
};

// Search is dynamic; never cache it.
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, page } = await searchParams;
  const term = (q ?? '').trim();

  if (!term) {
    return (
      <div className="container-lei max-w-2xl py-16">
        <h1 className="text-2xl font-bold">Search the catalogue</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Search by part number, machine model or brand.
        </p>
        <div className="mt-6">
          <HeroSearchWrapper />
        </div>
      </div>
    );
  }

  const result = await api.search(term, Number(page ?? 1));
  const { data: products, meta } = result;

  return (
    <div className="container-lei py-8">
      <h1 className="text-2xl font-bold">
        {meta.pagination.total > 0
          ? `${meta.pagination.total} result${meta.pagination.total === 1 ? '' : 's'} for “${term}”`
          : `No results for “${term}”`}
      </h1>

      {meta.matchType === 'part_number' && meta.pagination.total > 0 && (
        <p className="mt-1.5 text-sm text-ok">Matched on part number.</p>
      )}

      <div className="mt-6 max-w-xl">
        <HeroSearchWrapper />
      </div>

      {products.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCardTile key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <NoResults term={term} />
      )}
    </div>
  );
}

function HeroSearchWrapper() {
  return <HeroSearch />;
}

/**
 * The empty search state.
 *
 * This is the most commercially important empty state on the site. A customer
 * typing a part number LEI does not list is a QUALIFIED LEAD, not a dead end —
 * they have told us exactly what they want to buy. Converting that into an
 * enquiry is worth more than any other recovery this page could offer.
 *
 * The query is also captured server-side as SEARCH_NO_RESULTS, which becomes
 * the stocking backlog.
 */
function NoResults({ term }: { term: string }) {
  return (
    <div className="mt-10 max-w-xl">
      <div className="card p-6">
        <h2 className="text-base font-semibold">We don&rsquo;t list that part yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Our catalogue is still growing, and we source parts that are not listed. Tell us what you
          need and our team will come back to you with availability and pricing.
        </p>
        <Link
          href={`/contact?subject=${encodeURIComponent(`Part request: ${term}`)}`}
          className="btn-primary mt-4"
        >
          Request this part
        </Link>
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Check the spelling, or try
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {popularSearches.map((suggestion) => (
            <Link
              key={suggestion}
              href={`/search?q=${encodeURIComponent(suggestion)}`}
              className="rounded-md border border-ink-line px-3 py-1.5 text-sm hover:border-ink"
            >
              {suggestion}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm text-ink-muted">
          Not sure of the part number?{' '}
          <Link href="/compatibility" className="font-medium text-ink underline">
            Find parts by machine instead
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
