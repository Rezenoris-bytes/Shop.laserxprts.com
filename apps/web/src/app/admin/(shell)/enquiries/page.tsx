'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import type { AdminEnquiryRow } from '@/lib/api';
import {
  AdminPageHeader,
  DataTable,
  DemoBadge,
  StatusChip,
  type Column,
} from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';

const PIPELINE_STAGES = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'CALLED', label: 'Called' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CLOSED', label: 'Closed' },
];

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted'> = {
  NEW: 'warn',
  CALLED: 'ok',
  CONFIRMED: 'ok',
  CLOSED: 'muted',
};

export default function EnquiriesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState<AdminEnquiryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const status = params.get('status') ?? '';

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .enquiries({ status: status || undefined, q: search || undefined, perPage: 100 })
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
    { header: 'Phone', render: (row) => row.contactPhone ?? '—' },
    { header: 'Items', render: (row) => row._count.items },
    {
      header: 'Stage',
      render: (row) => (
        <select
          value={row.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const newStatus = e.target.value;
            setRows((current) =>
              current.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r))
            );
            adminApi.updateEnquiry(row.id, { status: newStatus }).catch(() => {
              // revert on error
              setRows((current) =>
                current.map((r) => (r.id === row.id ? { ...r, status: row.status } : r))
              );
            });
          }}
          className={[
            'cursor-pointer rounded-full border py-1 pl-3 pr-8 text-[11px] font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-1',
            STATUS_TONE[row.status] === 'warn' ? 'border-amber/40 bg-amber-wash text-amber-dark' :
            STATUS_TONE[row.status] === 'ok' ? 'border-green-600/20 bg-green-50 text-green-700' :
            'border-ink-line bg-ink-wash text-ink-muted'
          ].join(' ')}
        >
          {PIPELINE_STAGES.filter((s) => s.value).map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.value}
            </option>
          ))}
        </select>
      ),
    },
    { header: 'Received', render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Enquiries"
        description="All quote requests and customer enquiries."
      />

      {/* Pipeline filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((stage) => {
          const active = status === stage.value;
          return (
            <button
              key={stage.value}
              type="button"
              onClick={() => {
                const url = stage.value ? `/admin/enquiries?status=${stage.value}` : '/admin/enquiries';
                router.push(url);
              }}
              className={[
                'rounded-full border px-4 py-1 text-sm font-medium transition-colors',
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-ink-line bg-white text-ink hover:bg-ink-wash',
              ].join(' ')}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
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
