import type { Metadata } from 'next';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About LEI',
  description:
    'Laser Experts India supplies genuine spares and consumables for fiber laser cutting machines, ' +
    'backed by engineering support.',
  alternates: { canonical: canonical('/about') },
};

export default function AboutPage() {
  return (
    <div className="container-lei max-w-2xl py-12">
      <h1 className="text-2xl font-bold">About Laser Experts India</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Laser Experts India supplies spares and consumables for industrial fiber laser cutting
          machines, and provides the engineering support that goes with them.
        </p>
        <p>
          Our catalogue is organised around the machine you actually run: choose your cutting head
          and we show the parts recorded as fitting it, rather than asking you to cross-reference
          part numbers yourself.
        </p>
        <p className="rounded-md bg-ink-wash px-4 py-3 text-xs">
          This page is placeholder content pending copy from LEI.
        </p>
      </div>
    </div>
  );
}
