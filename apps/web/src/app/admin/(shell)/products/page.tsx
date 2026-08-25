'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminProductRow, type BulkUploadResult } from '@/lib/admin-api';
import {
  AdminPageHeader,
  DataTable,
  DemoBadge,
  StatusChip,
  type Column,
} from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function AdminProductsPage() {
  const auth = useAdminAuth();
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUpdate = auth.hasPermission('CATALOGUE', 'update');
  const canCreate = auth.hasPermission('CATALOGUE', 'create');

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

  const load = () =>
    adminApi
      .products({ q: search || undefined, perPage: 50 })
      .then((result) => setRows(result.data));

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await adminApi.bulkUploadTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'product-upload-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setUploadError((caught as Error).message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await adminApi.bulkUploadProducts(file);
      setUploadResult(result);
      await load();
    } catch (caught) {
      setUploadError((caught as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
          auth.hasPermission('CATALOGUE', 'create') ? (
            <Link href="/admin/products/new" className="btn-primary text-sm py-1.5">
              New product
            </Link>
          ) : null
        }
      />
      {canCreate && (
        <section className="card mb-4 flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold">Bulk upload</p>
            <p className="text-xs text-ink-muted">
              Add or update many products at once from a spreadsheet. Rows with the same product
              name become variants of one product (e.g. H15/H20/H25) — see the template for an
              example. New categories and brands are created automatically if they don&apos;t
              exist yet. Insert a photo directly into the &quot;image&quot; cell of an .xlsx file
              to attach it automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            disabled={downloadingTemplate}
            className="btn-secondary text-xs py-1.5"
          >
            {downloadingTemplate ? 'Preparing…' : 'Download template'}
          </button>
          <label className="btn-primary cursor-pointer text-xs py-1.5">
            {uploading ? 'Uploading…' : 'Upload file'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>

          {uploadError && <p className="w-full text-xs text-bad">{uploadError}</p>}
          {uploadResult && (
            <div className="w-full rounded border border-ink-line bg-ink-wash p-3 text-xs">
              <p className="font-medium">
                {uploadResult.created} created · {uploadResult.updated} updated ·{' '}
                {uploadResult.imagesAttached} photo(s) attached
                {(uploadResult.categoriesCreated > 0 || uploadResult.brandsCreated > 0) && (
                  <>
                    {' '}
                    ({uploadResult.categoriesCreated} new categor
                    {uploadResult.categoriesCreated === 1 ? 'y' : 'ies'}, {uploadResult.brandsCreated}
                    {' '}
                    new brand{uploadResult.brandsCreated === 1 ? '' : 's'})
                  </>
                )}
              </p>
              {uploadResult.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-bad">
                  {uploadResult.errors.map((err, index) => (
                    <li key={index}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

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

      <DataTable
        columns={columns}
        rows={rows}
        rowHref={(row) => `/admin/products/${row.id}`}
        isLoading={isLoading}
      />
    </div>
  );
}
