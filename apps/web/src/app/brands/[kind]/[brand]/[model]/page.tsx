import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, type ComponentKindSlug } from '@/lib/api';
import { canonical } from '@/lib/site';
import { ProductCardTile } from '@/components/product-card';
import { CompatibilityEmpty } from '@/components/compatibility-empty';

export const revalidate = 3600;

const KINDS: ComponentKindSlug[] = [
  'machines',
  'cutting-heads',
  'laser-sources',
  'chillers',
  'controllers',
  'servo',
];

const isKind = (value: string): value is ComponentKindSlug =>
  (KINDS as string[]).includes(value);

type Params = { params: Promise<{ kind: string; brand: string; model: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kind, brand, model } = await params;
  if (!isKind(kind)) return {};
  const detail = await api.componentModel(kind, brand, model).catch(() => null);
  if (!detail) return {};
  const title = `${detail.brand.name} ${detail.model.name} spares`;
  return {
    title,
    description: `Nozzles, protective windows, ceramics and spares for the ${detail.brand.name} ${detail.model.name}.`,
    alternates: { canonical: canonical(`/brands/${kind}/${brand}/${model}`) },
  };
}

/**
 * §15 component model page — e.g. /brands/cutting-heads/raytools/bm111.
 *
 * Products are grouped by category by the API so this page can show "Nozzles",
 * "Protective Windows", "Ceramic Components" as separate blocks. That grouping
 * is what makes the page useful: a customer arriving here knows their head and
 * wants to see the shape of what fits it, not a flat grid of sixty tiles.
 */
export default async function ComponentModelPage({ params }: Params) {
  const { kind, brand, model } = await params;
  if (!isKind(kind)) notFound();

  const detail = await api.componentModel(kind, brand, model).catch(() => null);
  if (!detail) notFound();

  const fullName = `${detail.brand.name} ${detail.model.name}`;

  return (
    <div className="container-lei py-12">
      <nav className="text-xs text-ink-muted">
        <Link href="/brands" className="hover:text-ink">
          Brands
        </Link>
        <span className="px-1">/</span>
        <Link href={`/brands/${kind}/${detail.brand.slug}`} className="hover:text-ink">
          {detail.brand.name}
        </Link>
        <span className="px-1">/</span>
        <span>{detail.model.name}</span>
      </nav>

      <h1 className="mt-6 text-2xl font-bold">{fullName}</h1>
      {detail.model.description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {detail.model.description}
        </p>
      ) : null}

      {detail.compatibilityVerified ? (
        <div className="mt-10 space-y-12">
          {detail.groups.map((group) => (
            <section key={group.slug}>
              <h2 className="text-lg font-semibold">{group.name}</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {group.products.map((product) => (
                  <ProductCardTile key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <CompatibilityEmpty className="mt-10" context={`the ${fullName}`} />
      )}
    </div>
  );
}
