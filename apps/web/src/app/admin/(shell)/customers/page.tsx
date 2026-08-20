'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminCustomerRow } from '@/lib/admin-api';
import {
  AdminPageHeader,
  DataTable,
  DemoBadge,
  StatusChip,
  type Column,
} from '@/components/admin/data-table';
import { formatDate } from '@/lib/format';

/**
 * Customers carry PII — this screen is reachable only with CUSTOMERS
 * permission, which a CATALOGUE admin's template does not grant.
 */
export default function CustomersPage() {
  const [rows, setRows] = useState<AdminCustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .customers({ q: search || undefined, perPage: 50 })
      .then((result) => setRows(result.data))
      .finally(() => setIsLoading(false));
  }, [search]);

  const columns: Column<AdminCustomerRow>[] = [
    {
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium">
            {row.companyName ?? row.contactName}
            <DemoBadge isSeedData={row.isSeedData} />
          </p>
          {row.companyName && <p className="text-xs text-ink-muted">{row.contactName}</p>}
        </div>
      ),
    },
    { header: 'Email', render: (row) => row.email ?? '—' },
    { header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusChip label={row.status} tone={row.status === 'ACTIVE' ? 'ok' : 'muted'} />
          {!row.isVerified && <StatusChip label="unverified" tone="warn" />}
        </div>
      ),
    },
    { header: 'Enquiries', render: (row) => row._count.enquiries },
    { header: 'Quotes', render: (row) => row._count.quotes },
    { header: 'Since', render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div>
      <AdminPageHeader title="Customers" />
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name, company, email or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="field max-w-sm"
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowHref={(row) => `/admin/customers/${row.id}`}
        isLoading={isLoading}
      />
    </div>
  );
}
