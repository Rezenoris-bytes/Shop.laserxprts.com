'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
  compact = false,
}: {
  machines: MachineBrandNode[];
  categories: CategoryNode[];
  compact?: boolean;
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
      className={compact ? 'space-y-3' : 'card space-y-4 p-5 sm:p-6'}
      aria-labelledby="finder-heading"
    >
      {!compact && (
        <div>
          <h2 id="finder-heading" className="text-lg font-bold">
            Find parts that fit your machine
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Select your head and we will narrow the catalogue.</p>
        </div>
      )}

      <div className={compact ? 'grid gap-3 sm:grid-cols-3' : 'space-y-3'}>
        <div>
          <label htmlFor="finder-brand" className="label">
            Machine brand
          </label>
          <select
            id="finder-brand"
            value={brandId}
            onChange={(event) => {
              setBrandId(event.target.value);
              setModelId('');
            }}
            className="field"
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
          <label htmlFor="finder-model" className="label">
            Model
          </label>
          <select
            id="finder-model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={!brandId}
            className="field disabled:bg-ink-wash disabled:text-ink-muted"
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
          <label htmlFor="finder-category" className="label">
            Part category
          </label>
          <select
            id="finder-category"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
            className="field"
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

      <button type="submit" className="btn-primary w-full" disabled={!brandId && !categorySlug}>
        Find compatible parts
      </button>

      {/*
        Honest about the data. The seeded compatibility claims are invented, and
        presenting them as a guarantee would be the one thing worse than having
        no compatibility data at all.
      */}
      <p className="text-center text-[11px] text-ink-muted">
        Compatibility shown is sample data and is not verified LEI information.
      </p>
    </form>
  );
}
