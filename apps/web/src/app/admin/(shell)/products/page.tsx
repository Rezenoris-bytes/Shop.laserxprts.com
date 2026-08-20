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
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUpdate = auth.hasPermission('CATALOGUE', 'update');

  /**
   * Publish state is the one field worth changing without opening a product,
   * so it is togglable from the list. The row is patched in place on success
   * rather than refetching all fifty — the response is authoritative for the
   * only field that changed.
   */
  const toggleActive = async (row: AdminProductRow) => {
    setBusyId(row.id);
    setError(null);
    try {
      await adminApi.updateProduct(row.id, { isActive: !row.isActive });
      setRows((current) =>
        current.map((item) => (item.id === row.id ? { ...item, isActive: !row.isActive } : item)),
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  };

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
          <StatusChip
            label={row.isActive ? 'Published' : 'Unpublished'}
            tone={row.isActive ? 'ok' : 'muted'}
          />
          <StatusChip label={row.hasStock ? 'In stock' : 'No stock'} tone={row.hasStock ? 'ok' : 'bad'} />
        </div>
      ),
    },
  ];

  if (canUpdate) {
    columns.push({
      header: '',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          disabled={busyId === row.id}
          onClick={() => void toggleActive(row)}
          // Names the product, so fifty identical "Unpublish" links are
          // distinguishable to a screen reader.
          aria-label={`${row.isActive ? 'Unpublish' : 'Publish'} ${row.name}`}
          className="rounded border border-ink-line px-2 py-1 text-xs font-medium hover:bg-ink-wash disabled:opacity-40"
        >
          {busyId === row.id ? '…' : row.isActive ? 'Unpublish' : 'Publish'}
        </button>
      ),
    });
  }

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
      {error && <p className="mb-3 text-xs text-bad">{error}</p>}

      <DataTable columns={columns} rows={rows} rowHref={(row) => `/admin/products/${row.id}`} isLoading={isLoading} />
    </div>
  );
}
