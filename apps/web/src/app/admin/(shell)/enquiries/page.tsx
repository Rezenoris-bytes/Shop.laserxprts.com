'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import type { AdminEnquiryRow } from '@/lib/api';
import { AdminPageHeader, DataTable, DemoBadge, StatusChip, type Column } from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted'> = {
  NEW: 'warn',
  ACKNOWLEDGED: 'muted',
  IN_PROGRESS: 'muted',
  QUOTED: 'ok',
  CLOSED_WON: 'ok',
  CLOSED_LOST: 'bad',
  SPAM: 'bad',
};

export default function EnquiriesPage() {
  const params = useSearchParams();
  const [rows, setRows] = useState<AdminEnquiryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const status = params.get('status') ?? undefined;

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .enquiries({ status, q: search || undefined, perPage: 50 })
      .then((result) => setRows(result.data))
      .finally(() => setIsLoading(false));
  }, [status, search]);

  const columns: Column<AdminEnquiryRow>[] = [
    {
      header: 'Reference',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.publicRef}
          <DemoBadge isSeedData={row.isSeedData} />
        </span>
      ),
    },
    {
      header: 'Contact',
      render: (row) => (
        <div>
          <p className="font-medium">{row.contactName}</p>
          {row.contactCompany && <p className="text-xs text-ink-muted">{row.contactCompany}</p>}
        </div>
      ),
    },
    { header: 'Items', render: (row) => row._count.items },
    {
      header: 'Status',
      render: (row) => <StatusChip label={row.status} tone={STATUS_TONE[row.status] ?? 'muted'} />,
    },
    { header: 'Assigned', render: (row) => row.assignedTo?.name ?? <span className="text-ink-muted">Unassigned</span> },
    { header: 'Received', render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Enquiries"
        description={status ? `Filtered: ${status}` : 'Every Quote Request submitted through the storefront.'}
      />

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by reference, name, company or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="field max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowHref={(row) => `/admin/enquiries/${row.id}`}
        isLoading={isLoading}
        emptyMessage="No enquiries match this view."
      />
    </div>
  );
}
