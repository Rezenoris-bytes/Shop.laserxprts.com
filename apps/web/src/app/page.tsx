import Link from 'next/link';

import { api } from '@/lib/api';
import { canonical, popularSearches } from '@/lib/site';
import { ProductCardTile } from '@/components/product-card';
import { CompatibilityFinder } from '@/components/compatibility-finder';

export const metadata = {
  alternates: { canonical: canonical('/') },
};

/**
 * Homepage.
 *
 * ISR rather than SSR: this content changes a few times a week, and rendering
 * it per request burns CPU on the same box as MySQL. Freshness comes from
 * on-demand revalidation when the catalogue changes.
 */
export const revalidate = 3600;

export default async function HomePage() {
  const [home, machines] = await Promise.all([api.home(), api.machineTree()]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink text-white">
        {/*
          The background uses a subtle radial gradient so the left text area is
          pure black for readability, fading slightly towards the right where
          the image sits.
        */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-ink via-ink/95 to-ink/50" />

        <div className="relative z-10 container-lei">
          <div className="flex flex-col lg:flex-row lg:items-center">
            
            {/* ── Content ── */}
            <div className="w-full py-8 lg:py-10 max-w-2xl">
              <h1 className="text-3xl font-black leading-[1.05] tracking-tight uppercase sm:text-4xl lg:text-5xl">
                The Right Parts,<br/>
                <span className="text-amber">The Right Performance.</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-white/70">
                Genuine laser spares and consumables for all major fiber laser cutting machines.
                Built for accuracy. Backed by LEI.
              </p>

              <div className="mt-8 mb-6">
                <CompatibilityFinder machines={machines} categories={home.categories} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/50">Popular:</span>
                {popularSearches.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/85 transition-colors hover:bg-white/20"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </section>



      {/* ── Categories ───────────────────────────────────────────────── */}
      <section className="container-lei py-12">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold">Shop by category</h2>
          <Link href="/catalogue" className="text-sm font-medium text-ink-muted hover:text-amber-dark">
            View all →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {home.categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              href={`/catalogue?category=${category.slug}`}
              className="card p-4 text-center transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-semibold leading-snug">{category.name}</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Products ─────────────────────────────────────────────────── */}
      <section className="container-lei pb-14">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold">Top selling products</h2>
          <Link href="/catalogue" className="text-sm font-medium text-ink-muted hover:text-amber-dark">
            View all →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {home.topProducts.slice(0, 8).map((product) => (
            <ProductCardTile key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ── Bulk enquiry ─────────────────────────────────────────────── */}
      <section className="container-lei pb-16">
        <div className="rounded-card bg-ink px-6 py-10 text-white sm:px-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold">
              Need bulk quantities?
              <span className="block text-amber">Get special pricing.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Add everything you need to one Quote Request and our team will price it together —
              no need to enquire about each part separately.
            </p>
            <Link href="/catalogue" className="btn-primary mt-6">
              Start a quote request
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
