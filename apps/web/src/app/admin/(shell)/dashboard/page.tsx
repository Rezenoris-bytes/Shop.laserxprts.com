'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminApi, type DashboardData } from '@/lib/admin-api';
import { AdminPageHeader } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

/**
 * Six fixed tiles — not a report builder. Each maps to an action someone
 * should take today, which is the point of a dashboard over a data dump.
 */
export default function DashboardPage() {
  const auth = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch(() => setError('Could not load the dashboard.'));
  }, []);

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!data) return <p className="text-sm text-ink-muted">Loading…</p>;

  const demoTotal = Object.values(data.demoData).reduce((sum, n) => sum + n, 0);

  return (
    <div>
      <AdminPageHeader title="Dashboard" />

      {demoTotal > 0 && (
        <div className="mb-6 rounded-card border border-amber/40 bg-amber-wash px-4 py-3 text-sm">
          <span className="font-semibold">Demo data present.</span> {demoTotal} sample records are
          loaded across the catalogue and will need purging before going live.
        </div>
      )}

      {data.placeholderSettings.length > 0 && (
        <div className="mb-6 rounded-card border border-amber/40 bg-amber-wash px-4 py-3 text-sm">
          <span className="font-semibold">
            {data.placeholderSettings.length} placeholder settings
          </span>{' '}
          still need real values (company details, terms) before quotes can go out for real.
          {auth.hasPermission('SETTINGS', 'view') && (
            <Link href="/admin/settings" className="ml-2 font-medium underline">
              Review settings →
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="New enquiries"
          value={data.enquiries.new}
          href="/admin/enquiries?status=NEW"
          tone={data.enquiries.new > 0 ? 'warn' : 'ok'}
        />
        <Tile
          label="Contacted"
          value={data.enquiries.contacted}
          href="/admin/enquiries?status=CONTACTED"
          tone="muted"
        />
        <Tile
          label="Total enquiries"
          value={data.enquiries.total}
          href="/admin/enquiries"
          tone="muted"
        />

        <Tile
          label="Draft quotes"
          value={data.quotes.draft}
          href="/admin/quotes?status=DRAFT"
          tone="muted"
        />
        <Tile
          label="Quotes expiring within 7 days"
          value={data.quotes.expiringSoon}
          href="/admin/quotes?expiring=soon"
          tone={data.quotes.expiringSoon > 0 ? 'warn' : 'ok'}
        />
        <Tile
          label="Active / inactive products"
          value={data.products.active + data.products.inactive}
          href="/admin/products"
          tone={data.products.inactive > 0 ? 'bad' : 'ok'}
        />
      </div>

      {data.searchNoResults.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Searches with no results (last 7 days)
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            The stocking backlog — parts customers want that are missing or misnamed.
          </p>
          <ul className="mt-3 divide-y divide-ink-line rounded-md border border-ink-line">
            {data.searchNoResults.map((row) => (
              <li
                key={row.normalized}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-mono">{row.normalized}</span>
                <span className="text-ink-muted">{row.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
}) {
  const toneClass = {
    ok: 'border-ok/30',
    warn: 'border-amber/40',
    bad: 'border-bad/30',
    muted: 'border-ink-line',
  }[tone];

  return (
    <Link
      href={href}
      className={`card block border p-5 transition-shadow hover:shadow-md ${toneClass}`}
    >
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Link>
  );
}
