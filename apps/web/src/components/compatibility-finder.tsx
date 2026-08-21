'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Crosshair, ArrowRight } from 'lucide-react';
import type { CategoryNode, MachineBrandNode } from '@/lib/api';

/**
 * "Find parts that fit your machine."
 *
 * The single most valuable element on the homepage: it matches how this
 * customer actually shops, and it is backed by real compatibility data.
 *
 * The whole brand/model/variant tree arrives in ONE payload. Three dependent
 * dropdowns served as three endpoints would cost three sequential round trips
 * on mobile 4G before the customer can act — which is exactly the friction the
 * finder exists to remove.
 */
export function CompatibilityFinder({
  machines,
  categories,
}: {
  machines: MachineBrandNode[];
  categories: CategoryNode[];
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [categorySlug, setCategorySlug] = useState('');

  const models = useMemo(
    () => machines.find((brand) => String(brand.id) === brandId)?.models ?? [],
    [machines, brandId],
  );

  const flatCategories = useMemo(() => {
    const output: Array<{ slug: string; label: string }> = [];
    const walk = (nodes: CategoryNode[], depth = 0) => {
      for (const node of nodes) {
        output.push({ slug: node.slug, label: `${'— '.repeat(depth)}${node.name}` });
        if (node.children.length) walk(node.children, depth + 1);
      }
    };
    walk(categories);
    return output;
  }, [categories]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (modelId) params.set('machineModel', modelId);
    else if (brandId) params.set('machineBrand', brandId);
    if (categorySlug) params.set('category', categorySlug);
    router.push(`/catalogue?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm sm:p-5"
      aria-labelledby="finder-heading"
    >
      <div className="mb-4 flex items-start gap-3">
        <Crosshair className="mt-0.5 h-7 w-7 shrink-0 text-amber" strokeWidth={2} />
        <div>
          <h2 id="finder-heading" className="text-lg font-bold uppercase tracking-wide text-white">
            Find parts that fit your machine
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Select your head and we will narrow the catalogue.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="finder-brand"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/80"
          >
            Machine brand
          </label>
          <select
            id="finder-brand"
            value={brandId}
            onChange={(event) => {
              setBrandId(event.target.value);
              setModelId('');
            }}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber [&>option]:text-ink"
          >
            <option value="">Select brand</option>
            {machines.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="finder-model"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/80"
          >
            Model
          </label>
          <select
            id="finder-model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={!brandId}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber disabled:opacity-50 [&>option]:text-ink"
          >
            <option value="">{brandId ? 'Select model' : 'Choose a brand first'}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="finder-category"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/80"
          >
            Part category
          </label>
          <select
            id="finder-category"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber [&>option]:text-ink"
          >
            <option value="">All categories</option>
            {flatCategories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-amber px-4 py-3 text-sm font-bold uppercase tracking-wide text-ink transition-colors hover:bg-amber-dark disabled:opacity-70 disabled:hover:bg-amber"
        disabled={!brandId && !categorySlug}
      >
        Find compatible parts
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
