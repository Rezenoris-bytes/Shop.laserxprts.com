'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AdminUserRow } from '@/lib/admin-api';
import { PermissionGate } from '@/components/admin/permission-gate';
import { AdminPageHeader, DataTable, StatusChip, type Column } from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';
import { ApiRequestError } from '@/lib/api';

const DEPARTMENTS = ['SALES', 'SERVICE', 'CATALOGUE', 'CONTENT', 'OPERATIONS'];
const MODULES = [
  'CATALOGUE', 'INVENTORY', 'MACHINES', 'SERVICES', 'SERVICE_REQUESTS',
  'CUSTOMERS', 'ENQUIRIES', 'LEADS', 'QUOTES', 'ORDERS', 'REPORTS',
  'USERS', 'AUDIT', 'SETTINGS',
];

/**
 * SUPER_ADMIN only, in practice: the USERS permission is never granted by any
 * department template, and the guard rejects anyone else server-side even if
 * this page were reached directly.
 */
export default function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<number | null>(null);

  const load = () => adminApi.users().then(setRows);

  useEffect(() => {
    load();
  }, []);

  const columns: Column<AdminUserRow>[] = [
    { header: 'Name', render: (row) => row.name },
    { header: 'Email', render: (row) => row.email },
    { header: 'Role', render: (row) => (row.role === 'SUPER_ADMIN' ? 'Super Admin' : row.department) },
    { header: 'Status', render: (row) => <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'ok' : 'muted'} /> },
    { header: 'Last login', render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never') },
    {
      header: '',
      render: (row) =>
        row.role !== 'SUPER_ADMIN' && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditingPermissions(row.id)} className="text-xs underline">
              Permissions
            </button>
            <button
              type="button"
              onClick={async () => {
                await (row.isActive ? adminApi.deactivateUser(row.id) : adminApi.activateUser(row.id));
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
    <PermissionGate module="USERS">
    <div>
      <AdminPageHeader
        title="Users & Permissions"
        action={
          <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
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

      {editingPermissions !== null && (
        <PermissionsEditor
          user={rows.find((r) => r.id === editingPermissions)!}
          onClose={() => setEditingPermissions(null)}
          onSaved={() => {
            setEditingPermissions(null);
            load();
          }}
        />
      )}
    </div>
    </PermissionGate>
  );
}

function NewUserForm({ onCreated }: { onCreated: (email: string, password: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('SALES');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await adminApi.createUser({ name, email, department });
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
        <input id="uname" required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="uemail" className="label">
          Email
        </label>
        <input id="uemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="udept" className="label">
          Department
        </label>
        <select id="udept" value={department} onChange={(e) => setDepartment(e.target.value)} className="field">
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary">
        Create
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </form>
  );
}

function PermissionsEditor({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [grants, setGrants] = useState(() => {
    const map = new Map(user.permissions.map((p) => [p.module, p]));
    return MODULES.map(
      (module) =>
        map.get(module) ?? { module, canView: false, canCreate: false, canUpdate: false, canDelete: false },
    );
  });

  const toggle = (module: string, key: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete') => {
    setGrants((current) => current.map((g) => (g.module === module ? { ...g, [key]: !g[key] } : g)));
  };

  const save = async () => {
    await adminApi.setPermissions(
      user.id,
      grants.filter((g) => g.canView || g.canCreate || g.canUpdate || g.canDelete),
    );
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6">
        <h2 className="text-base font-bold">Permissions — {user.name}</h2>
        <table className="mt-4 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-ink-line text-ink-muted">
              <th className="py-1.5">Module</th>
              <th className="py-1.5">View</th>
              <th className="py-1.5">Create</th>
              <th className="py-1.5">Update</th>
              <th className="py-1.5">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {grants.map((grant) => (
              <tr key={grant.module}>
                <td className="py-1.5 font-medium">{grant.module}</td>
                {(['canView', 'canCreate', 'canUpdate', 'canDelete'] as const).map((key) => (
                  <td key={key} className="py-1.5">
                    <input type="checkbox" checked={grant[key]} onChange={() => toggle(grant.module, key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button type="button" onClick={save} className="btn-primary text-sm">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
