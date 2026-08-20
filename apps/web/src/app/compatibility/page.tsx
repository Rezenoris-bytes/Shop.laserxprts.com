import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { canonical } from '@/lib/site';
import { CompatibilityFinder } from '@/components/compatibility-finder';

export const metadata: Metadata = {
  title: 'Find parts for your machine',
  description:
    'Select your laser cutting head and we will show the spares and consumables that fit it.',
  alternates: { canonical: canonical('/compatibility') },
};

export const revalidate = 3600;

export default async function CompatibilityPage() {
  // Fail soft when the API is unreachable — see the homepage for why the
  // build must survive a backend that is not running yet.
  const [machines, categories] = await Promise.all([
    api.machineTree().catch(() => []),
    api.categories().catch(() => []),
  ]);

  return (
    <div className="container-lei max-w-3xl py-12">
      <h1 className="text-2xl font-bold">Find parts that fit your machine</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Choose your cutting head and we will narrow the catalogue to parts recorded as compatible.
        Not sure of the model? It is usually printed on the head body.
      </p>

      <div className="mt-8">
        <CompatibilityFinder machines={machines} categories={categories} />
      </div>
    </div>
  );
}
