import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, type ComponentKindSlug } from '@/lib/api';
import { canonical } from '@/lib/site';
import { ProductCardTile } from '@/components/product-card';
import { CompatibilityEmpty } from '@/components/compatibility-empty';

export const revalidate = 3600;

const KIND_LABELS: Record<ComponentKindSlug, string> = {
  machines: 'Machine brand',
  'cutting-heads': 'Cutting head brand',
  'laser-sources': 'Laser source brand',
  chillers: 'Chiller brand',
  controllers: 'Controller brand',
  servo: 'Servo brand',
};

const isKind = (value: string): value is ComponentKindSlug => value in KIND_LABELS;

type Params = { params: Promise<{ kind: string; brand: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kind, brand } = await params;
  if (!isKind(kind)) return {};
  const detail = await api.componentBrand(kind, brand).catch(() => null);
  if (!detail) return {};
  return {
    title: `${detail.name} spares & consumables`,
    description: `Parts, models and compatibility information for ${detail.name}.`,
    alternates: { canonical: canonical(`/brands/${kind}/${brand}`) },
  };
}

/**
 * §14 brand page.
 *
 * Machine brands and component brands render through the same page on purpose:
 * structurally they are identical (a brand, its models, the parts that fit
 * them). What differs is only the label, so forking this into two pages would
 * duplicate the empty-state and product-grid logic for no gain.
 */
export default async function BrandPage({ params }: Params) {
  const { kind, brand } = await params;
  if (!isKind(kind)) notFound();

  const detail = await api.componentBrand(kind, brand).catch(() => null);
  if (!detail) notFound();

  const modelPathKind = kind;

  return (
    <div className="container-lei py-12">
      <nav className="text-xs text-ink-muted">
        <Link href="/brands" className="hover:text-ink">
          Brands
        </Link>
        <span className="px-1">/</span>
        <span>{detail.name}</span>
      </nav>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {KIND_LABELS[kind]}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{detail.name}</h1>

      {/* ── Models ─────────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Models</h2>
        {detail.models.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-ink-line bg-ink-wash p-4 text-sm text-ink-muted">
            We have not published a model list for {detail.name} yet. Tell us what you run and we
            will identify the part you need.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {detail.models.map((model) => (
              <li key={model.id}>
                <Link
                  href={`/brands/${modelPathKind}/${detail.slug}/${model.slug}`}
                  className="flex h-full flex-col justify-between rounded-lg border border-ink-line bg-white p-4 transition-colors hover:border-amber hover:bg-amber-wash"
                >
                  <span className="text-sm font-semibold text-ink">{model.name}</span>
                  <span className="mt-2 text-xs text-ink-muted">
                    {model.productCount > 0
                      ? `${model.productCount} verified part${model.productCount === 1 ? '' : 's'}`
                      : 'Compatibility on request'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Compatible products ────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Parts for {detail.name}</h2>
        {detail.compatibilityVerified ? (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {detail.products.map((product) => (
              <ProductCardTile key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <CompatibilityEmpty className="mt-4" context={detail.name} />
        )}
      </section>
    </div>
  );
}
