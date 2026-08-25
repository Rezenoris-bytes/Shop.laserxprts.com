import { AdminPageHeader } from '@/components/admin/data-table';

/**
 * Quotes, revisions and PDF generation are the next stage of work — the
 * quote/PDF/email loop that closes the sales side of the vertical slice.
 * This stub exists so links from the dashboard and enquiry detail page do
 * not 404 in the meantime.
 */
export default function QuotesPage() {
  return (
    <div>
      <AdminPageHeader title="Quotes" />
      <div className="card px-6 py-14 text-center">
        <p className="text-sm font-semibold">Quote builder is not yet available</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Revisions and PDF generation are the next stage of work.
        </p>
      </div>
    </div>
  );
}
