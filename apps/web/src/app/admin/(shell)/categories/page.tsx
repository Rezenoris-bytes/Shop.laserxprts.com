'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminCategory } from '@/lib/admin-api';
import {
  AdminPageHeader,
  DataTable,
  DemoBadge,
  StatusChip,
  type Column,
} from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function CategoriesPage() {
  const auth = useAdminAuth();
  const [rows, setRows] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminApi
      .categories()
      .then(setRows)
      .finally(() => setIsLoading(false));

  useEffect(() => {
    load();
  }, []);

  const canCreate = auth.hasPermission('CATALOGUE', 'create');
  const canUpdate = auth.hasPermission('CATALOGUE', 'update');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await adminApi.createCategory({
        name,
        parentId: parentId ? Number(parentId) : null,
        sortOrder: 0,
        isActive: true,
      });
      setName('');
      setParentId('');
      setShowForm(false);
      await load();
    } catch {
      setError('Could not create category. Check the name is not already in use.');
    }
  };

  const toggleActive = async (row: AdminCategory) => {
    await adminApi.updateCategory(row.id, { isActive: !row.isActive });
    await load();
  };

  const columns: Column<AdminCategory>[] = [
    {
      header: 'Name',
      render: (row) => (
        <span>
          {row.parent && <span className="text-ink-muted">{row.parent.name} / </span>}
          {row.name}
          <DemoBadge isSeedData={row.isSeedData} />
        </span>
      ),
    },
    {
      header: 'Slug',
      render: (row) => <span className="font-mono text-xs text-ink-muted">{row.slug}</span>,
    },
    { header: 'Products', render: (row) => row.productCount },
    {
      header: 'Status',
      render: (row) =>
        canUpdate ? (
          <button type="button" onClick={() => toggleActive(row)} className="cursor-pointer">
            <StatusChip
              label={row.isActive ? 'Active' : 'Inactive'}
              tone={row.isActive ? 'ok' : 'muted'}
            />
          </button>
        ) : (
          <StatusChip
            label={row.isActive ? 'Active' : 'Inactive'}
            tone={row.isActive ? 'ok' : 'muted'}
          />
        ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        action={
          canCreate && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary text-sm"
            >
              {showForm ? 'Cancel' : 'New category'}
            </button>
          )
        }
      />

      {showForm && (
        <form onSubmit={create} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="parent" className="label">
              Parent (optional)
            </label>
            <select
              id="parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="field"
            >
              <option value="">None (top level)</option>
              {rows
                .filter((r) => !r.parentId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
          {error && <p className="text-xs text-bad">{error}</p>}
        </form>
      )}

      <DataTable columns={columns} rows={rows} isLoading={isLoading} />
    </div>
  );
}
