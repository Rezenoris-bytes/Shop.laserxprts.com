import type { Metadata } from 'next';
import Link from 'next/link';
import { api, type BrandSummary, type ComponentKindSlug } from '@/lib/api';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Brands we support',
  description:
    'Machine makers, cutting heads, laser sources, chillers, controllers and servo drives supported by LEI.',
  alternates: { canonical: canonical('/brands') },
};

export const revalidate = 3600;

/**
 * §14 brand directory.
 *
 * Grouped by component kind rather than shown as one alphabetical list,
 * because the same name means different things in different groups: Mitsubishi
 * is a machine maker AND a servo maker, and merging them would tell a customer
 * with a Mitsubishi servo drive to go and look at press brakes.
 */
const SECTIONS: Array<{ kind: ComponentKindSlug; title: string; blurb: string }> = [
  {
    kind: 'machines',
    title: 'Machine brands',
    blurb: 'The laser cutting machines our customers run.',
  },
  {
    kind: 'cutting-heads',
    title: 'Cutting head brands',
    blurb: 'Heads are the part that actually determines which nozzle or window fits.',
  },
  { kind: 'laser-sources', title: 'Laser sources', blurb: 'Fiber source makers.' },
  { kind: 'chillers', title: 'Chillers', blurb: 'Cooling systems and their spares.' },
  { kind: 'controllers', title: 'Controllers', blurb: 'CNC and cutting control systems.' },
  { kind: 'servo', title: 'Servo & motion', blurb: 'Drives and motors.' },
];

export default async function BrandsPage() {
  // Fail soft: the page must still render if the API is down, the same way the
  // homepage does. An empty section is better than a 500.
  const results = await Promise.all(
    SECTIONS.map(async (section) => ({
      ...section,
      brands: await api.componentBrands(section.kind).catch((): BrandSummary[] => []),
    })),
  );

  return (
    <div className="container-lei py-12">
      <h1 className="text-2xl font-bold">Brands we support</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        A brand here means the maker of a component, not a category of part. The same nozzle often
        fits machines from several makers, so we list parts against the cutting head they belong
        to.
      </p>

      <div className="mt-10 space-y-12">
        {results.map((section) => (
          <section key={section.kind}>
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{section.blurb}</p>

            {section.brands.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-ink-line bg-ink-wash p-4 text-sm text-ink-muted">
                No brands listed yet.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.brands.map((brand) => (
                  <li key={brand.id}>
                    <Link
                      href={`/brands/${section.kind}/${brand.slug}`}
                      className="flex h-full flex-col justify-between rounded-lg border border-ink-line bg-white p-4 transition-colors hover:border-amber hover:bg-amber-wash"
                    >
                      <span className="text-sm font-semibold text-ink">{brand.name}</span>
                      <span className="mt-2 text-xs text-ink-muted">
                        {brand.modelCount > 0
                          ? `${brand.modelCount} model${brand.modelCount === 1 ? '' : 's'}`
                          : 'Models on request'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
