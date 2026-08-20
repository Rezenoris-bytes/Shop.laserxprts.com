'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminProductRow } from '@/lib/admin-api';
import { AdminPageHeader, DataTable, DemoBadge, StatusChip, type Column } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function AdminProductsPage() {
  const auth = useAdminAuth();
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .products({ q: search || undefined, perPage: 50 })
      .then((result) => setRows(result.data))
      .finally(() => setIsLoading(false));
  }, [search]);

  const columns: Column<AdminProductRow>[] = [
    {
      header: 'Product',
      render: (row) => (
        <span className="font-medium">
          {row.name}
          <DemoBadge isSeedData={row.isSeedData} />
          {row.isFeatured && <StatusChip label="featured" tone="warn" />}
        </span>
      ),
    },
    { header: 'Category', render: (row) => row.category?.name ?? '—' },
    { header: 'Brand', render: (row) => row.partBrand?.name ?? '—' },
    { header: 'Variants', render: (row) => row._count.variants },
    {
      header: 'Price',
      render: (row) =>
        row.minPrice
          ? row.maxPrice && row.maxPrice !== row.minPrice
            ? `₹${row.minPrice} – ₹${row.maxPrice}`
            : `₹${row.minPrice}`
          : '—',
    },
    {
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'ok' : 'muted'} />
          <StatusChip label={row.hasStock ? 'In stock' : 'No stock'} tone={row.hasStock ? 'ok' : 'bad'} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Products"
        action={
          auth.hasPermission('CATALOGUE', 'create') && (
            <Link href="/admin/products/new" className="btn-primary text-sm">
              New product
            </Link>
          )
        }
      />
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or slug…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="field max-w-sm"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowHref={(row) => `/admin/products/${row.id}`} isLoading={isLoading} />
    </div>
  );
}
