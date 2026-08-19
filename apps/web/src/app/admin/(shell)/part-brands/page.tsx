'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminPartBrand } from '@/lib/admin-api';
import { AdminPageHeader, DataTable, DemoBadge, StatusChip, type Column } from '@/components/admin/data-table';
import { useAdminAuth } from '@/lib/admin-auth';

export default function PartBrandsPage() {
  const auth = useAdminAuth();
  const [rows, setRows] = useState<AdminPartBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const load = () => adminApi.partBrands().then(setRows).finally(() => setIsLoading(false));

  useEffect(() => {
    load();
  }, []);

  const canCreate = auth.hasPermission('CATALOGUE', 'create');
  const canUpdate = auth.hasPermission('CATALOGUE', 'update');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await adminApi.createPartBrand({ name, isActive: true });
    setName('');
    setShowForm(false);
    await load();
  };

  const toggleActive = async (row: AdminPartBrand) => {
    await adminApi.updatePartBrand(row.id, { isActive: !row.isActive });
    await load();
  };

  const columns: Column<AdminPartBrand>[] = [
    { header: 'Name', render: (row) => <span>{row.name} <DemoBadge isSeedData={row.isSeedData} /></span> },
    { header: 'Slug', render: (row) => <span className="font-mono text-xs text-ink-muted">{row.slug}</span> },
    {
      header: 'Status',
      render: (row) =>
        canUpdate ? (
          <button type="button" onClick={() => toggleActive(row)}>
            <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'ok' : 'muted'} />
          </button>
        ) : (
          <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'ok' : 'muted'} />
        ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Part Brands"
        action={
          canCreate && (
            <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
              {showForm ? 'Cancel' : 'New brand'}
            </button>
          )
        }
      />
      {showForm && (
        <form onSubmit={create} className="card mb-6 flex items-end gap-3 p-4">
          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </form>
      )}
      <DataTable columns={columns} rows={rows} isLoading={isLoading} />
    </div>
  );
}
