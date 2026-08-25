'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminUserRow } from '@/lib/admin-api';
import { AdminPageHeader, DataTable, StatusChip, type Column } from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';
import { ApiRequestError } from '@/lib/api';

const MODULES: string[] = [];

/**
 * SUPER_ADMIN only, in practice: the USERS permission is never granted by any
 * department template, and the guard rejects anyone else server-side even if
 * this page were reached directly.
 */
export default function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const load = () => adminApi.users().then(setRows);

  useEffect(() => {
    load();
  }, []);

  const columns: Column<AdminUserRow>[] = [
    { header: 'Name', render: (row) => row.name },
    { header: 'Email', render: (row) => row.email },
    {
      header: 'Role',
      render: () => 'Owner',
    },
    {
      header: 'Status',
      render: (row) => (
        <StatusChip
          label={row.isActive ? 'Active' : 'Inactive'}
          tone={row.isActive ? 'ok' : 'muted'}
        />
      ),
    },
    {
      header: 'Last login',
      render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'),
    },
    {
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await (row.isActive
                ? adminApi.deactivateUser(row.id)
                : adminApi.activateUser(row.id));
              await load();
            }}
            className="text-xs text-bad underline"
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Users"
          action={
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary text-sm"
            >
              {showForm ? 'Cancel' : 'New admin'}
            </button>
          }
        />

        {created && (
          <div className="mb-6 rounded-card border border-ok/30 bg-green-50 px-4 py-3 text-sm">
            <p className="font-semibold">Admin created.</p>
            <p className="mt-1">
              Temporary password for <span className="font-mono">{created.email}</span>:{' '}
              <span className="font-mono font-bold">{created.temporaryPassword}</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Shown once. They must change it on first login.
            </p>
          </div>
        )}

        {showForm && (
          <NewUserForm
            onCreated={(email, temporaryPassword) => {
              setCreated({ email, temporaryPassword });
              setShowForm(false);
              load();
            }}
          />
        )}

        <DataTable columns={columns} rows={rows} />

    </div>
  );
}

function NewUserForm({ onCreated }: { onCreated: (email: string, password: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await adminApi.createUser({ name, email });
      onCreated(result.user.email, result.temporaryPassword);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create admin.');
    }
  };

  return (
    <form onSubmit={submit} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label htmlFor="uname" className="label">
          Name
        </label>
        <input
          id="uname"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="uemail" className="label">
          Email
        </label>
        <input
          id="uemail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
      </div>

      <button type="submit" className="btn-primary">
        Create
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </form>
  );
}

