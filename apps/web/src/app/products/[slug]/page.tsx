import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiRequestError, api } from '@/lib/api';
import { canonical, demoMode, siteName } from '@/lib/site';
import { VariantSelector } from '@/components/variant-selector';
import { ProductCardTile } from '@/components/product-card';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await api.product(slug);
    return {
      title: product.seo.metaTitle ?? product.name,
      description: product.seo.metaDescription ?? product.shortDescription ?? undefined,
      // Canonical is DERIVED from the slug, never read from a stored absolute
      // URL — stored canonicals rot silently on any domain change.
      alternates: { canonical: canonical(`/products/${product.slug}`) },
      openGraph: {
        title: product.seo.ogTitle ?? product.name,
        description: product.seo.ogDescription ?? product.shortDescription ?? undefined,
        url: canonical(`/products/${product.slug}`),
        type: 'website',
      },
      robots: product.seo.indexable && !demoMode ? undefined : { index: false, follow: true },
    };
  } catch {
    return { title: 'Product not found' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  let product;
  try {
    product = await api.product(slug);
  } catch (error) {
    // A withdrawn product returns 404 rather than a 200 empty page. A soft 404
    // is read as "a working page with no content" and drags on site quality.
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const claimed = product.compatibility.filter((row) => !row.isVerified);

  return (
    <>
      <StructuredData product={product} />

      <div className="container-lei py-8">
        <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/catalogue" className="hover:text-ink">
                Catalogue
              </Link>
            </li>
            {product.category && (
              <>
                <li aria-hidden>/</li>
                <li>
                  <Link
                    href={`/catalogue?category=${product.category.slug}`}
                    className="hover:text-ink"
                  >
                    {product.category.name}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="card grid aspect-[4/3] place-items-center bg-ink-wash">
              <svg viewBox="0 0 200 150" className="h-3/5 w-3/5" role="img" aria-label={`${product.name} — image placeholder`}>
                <g fill="none" stroke="#b9c2cc" strokeWidth="2">
                  <circle cx="100" cy="75" r="46" />
                  <circle cx="100" cy="75" r="30" />
                  <circle cx="100" cy="75" r="14" />
                  <path d="M100 20v110M45 75h110" strokeWidth="1" opacity="0.4" />
                </g>
              </svg>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              Product photography pending — placeholder shown.
            </p>
          </div>

          <div>
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {product.brand.name}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h1>
            {product.shortDescription && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{product.shortDescription}</p>
            )}

            <div className="mt-6">
              <VariantSelector product={product} />
            </div>

            {product.hsnCode && (
              <p className="mt-4 text-[11px] text-ink-muted">
                HSN {product.hsnCode}
                {product.gstRate !== null && ` · GST ${product.gstRate}%`}
                {demoMode && ' · placeholder value'}
              </p>
            )}
          </div>
        </div>

        {/* ── Specifications ─────────────────────────────────────────── */}
        {product.specs.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-bold">Specifications</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-0 sm:grid-cols-2">
              {product.specs.map((spec) => (
                <div
                  key={spec.slug}
                  className="flex justify-between gap-4 border-b border-ink-line py-2.5 text-sm"
                >
                  <dt className="text-ink-muted">{spec.name}</dt>
                  <dd className="text-right font-medium">
                    {spec.value}
                    {spec.unit && <span className="ml-1 text-ink-muted">{spec.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ── Compatibility ──────────────────────────────────────────── */}
        {product.compatibility.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-bold">Machine compatibility</h2>

            {/*
              Claimed and verified fitment look different, deliberately.
              A confident wrong fitment costs more than a missing one: the
              customer orders, it does not fit, and they stop trusting the
              catalogue.
            */}
            {claimed.length > 0 && (
              <div className="mt-3 rounded-card border border-amber/40 bg-amber-wash px-4 py-3">
                <p className="text-xs leading-relaxed text-ink">
                  <span className="font-semibold">Not yet verified.</span> The fitment below is
                  sample data and has not been confirmed by an LEI engineer. Please check with our
                  team before ordering.
                </p>
              </div>
            )}

            {/*
              Grouped by machine model. A family whose fitment is recorded per
              variant produces one row PER VARIANT, so an ungrouped list showed
              "Raytools BM110" three times over. The customer cares which
              machines the product fits, not how many rows say so.
            */}
            <ul className="mt-4 flex flex-wrap gap-2">
              {groupCompatibility(product.compatibility).map((entry) => (
                <li
                  key={entry.key}
                  className={[
                    'rounded-md border px-3 py-2 text-sm',
                    entry.isVerified ? 'border-ok/30 bg-green-50' : 'border-ink-line bg-white',
                  ].join(' ')}
                >
                  <span className="font-medium">{entry.label}</span>
                  {entry.machineVariants.length > 0 && (
                    <span className="ml-1.5 text-ink-muted">
                      ({entry.machineVariants.join(', ')})
                    </span>
                  )}
                  {entry.isPartial && (
                    <span className="ml-1.5 text-[11px] text-ink-muted">
                      selected options only
                    </span>
                  )}
                  {entry.isVerified && <span className="ml-1.5 text-[11px] text-ok">verified</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Description ────────────────────────────────────────────── */}
        {product.description && (
          <section className="mt-14 max-w-3xl">
            <h2 className="text-lg font-bold">About this part</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {product.description}
            </p>
          </section>
        )}

        {/* ── Related by compatibility — the highest-value internal links ── */}
        {product.related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-bold">Other parts for the same machines</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {product.related.slice(0, 4).map((related) => (
                <ProductCardTile key={related.id} product={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * schema.org Product.
 *
 * Variants with a fixed price emit an AggregateOffer. Price-on-request items
 * emit availability WITHOUT a price rather than a fake zero, which would be
 * flagged in Search Console and is simply untrue.
 */
function StructuredData({ product }: { product: Awaited<ReturnType<typeof api.product>> }) {
  const priced = product.variants.filter((v) => v.priceType === 'FIXED' && v.price !== null);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? undefined,
    sku: product.variants[0]?.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name,
  };

  if (priced.length > 0) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...priced.map((v) => v.price!)),
      highPrice: Math.max(...priced.map((v) => v.price!)),
      offerCount: priced.length,
      availability: product.hasStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      seller: { '@type': 'Organization', name: siteName },
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface CompatibilityGroup {
  key: string;
  label: string;
  machineVariants: string[];
  isVerified: boolean;
  /** Fitment recorded against specific product variants, not the whole family. */
  isPartial: boolean;
}

/** Collapses per-variant fitment rows into one entry per machine model. */
function groupCompatibility(
  rows: Awaited<ReturnType<typeof api.product>>['compatibility'],
): CompatibilityGroup[] {
  const groups = new Map<string, CompatibilityGroup>();

  for (const row of rows) {
    const key = `${row.brand.id}-${row.model.id}`;
    const existing = groups.get(key);

    if (existing) {
      if (row.machineVariant && !existing.machineVariants.includes(row.machineVariant.name)) {
        existing.machineVariants.push(row.machineVariant.name);
      }
      // Verified anywhere in the group is the honest summary only if every row
      // agrees; a single unverified row keeps the whole entry unverified.
      existing.isVerified = existing.isVerified && row.isVerified;
      existing.isPartial = existing.isPartial || row.variantId !== null;
      continue;
    }

    groups.set(key, {
      key,
      label: `${row.brand.name} ${row.model.name}`,
      machineVariants: row.machineVariant ? [row.machineVariant.name] : [],
      isVerified: row.isVerified,
      isPartial: row.variantId !== null,
    });
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
