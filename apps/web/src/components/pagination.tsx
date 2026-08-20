'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function Pagination({ meta }: { meta: PaginationMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (meta.totalPages <= 1) return null;

  const go = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    router.push(`${pathname}${next.size ? `?${next}` : ''}`);
  };

  const from = (meta.page - 1) * meta.perPage + 1;
  const to = Math.min(meta.page * meta.perPage, meta.total);

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4">
      <p className="text-xs text-ink-muted">
        Showing {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(meta.page - 1)}
          disabled={!meta.hasPrev}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Previous
        </button>
        <span className="text-xs text-ink-muted">
          Page {meta.page} of {meta.totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(meta.page + 1)}
          disabled={!meta.hasNext}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
