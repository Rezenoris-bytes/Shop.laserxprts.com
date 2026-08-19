'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * One list-view pattern, reused everywhere.
 *
 * Building ~18 bespoke admin tables is where the "18 hours for the admin
 * panel" estimate goes wrong. One configurable component instead: columns,
 * rows and an optional row link are the only per-screen inputs.
 */
export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  rowHref,
  isLoading,
  emptyMessage = 'No records found.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-md border border-ink-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse border-b border-ink-line bg-ink-wash/50 last:border-0" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-ink-line px-6 py-14 text-center text-sm text-ink-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-ink-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-line bg-ink-wash">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line">
          {rows.map((row) => {
            const href = rowHref?.(row);
            const cells = columns.map((column) => (
              <td key={column.header} className={`px-3 py-2.5 align-middle ${column.className ?? ''}`}>
                {column.render(row)}
              </td>
            ));
            return href ? (
              <tr key={row.id} className="transition-colors hover:bg-ink-wash/60">
                {columns.map((column, index) => (
                  <td key={column.header} className={`px-3 py-2.5 align-middle ${column.className ?? ''}`}>
                    {index === 0 ? (
                      <Link href={href} className="block">
                        {column.render(row)}
                      </Link>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={row.id} className="hover:bg-ink-wash/60">
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Badge for is_seed_data rows — never let a seeded record look like a real one. */
export function DemoBadge({ isSeedData }: { isSeedData: boolean }) {
  if (!isSeedData) return null;
  return (
    <span className="chip ml-1.5 bg-amber-wash text-warn" title="Sample/demo data">
      DEMO
    </span>
  );
}

export function StatusChip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const classes = {
    ok: 'bg-green-50 text-ok',
    warn: 'bg-amber-wash text-warn',
    bad: 'bg-red-50 text-bad',
    muted: 'bg-ink-wash text-ink-muted',
  } as const;
  return <span className={`chip ${classes[tone]}`}>{label}</span>;
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
