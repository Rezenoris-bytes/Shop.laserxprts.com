'use client';

import { useEffect, useState } from 'react';
import { adminApi, type AuditLogRow } from '@/lib/admin-api';
import { AdminPageHeader, DataTable, StatusChip, type Column } from '@/components/admin/data-table';
import { formatDateTime } from '@/lib/format';

/**
 * SUPER_ADMIN only — audit data is not delegated to any department template,
 * matching the source design's "Audit remains Super Admin only for MVP".
 */
export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi
      .auditLogs({ perPage: 100 })
      .then((result) => setRows(result.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<AuditLogRow>[] = [
    { header: 'When', render: (row) => formatDateTime(row.createdAt) },
    { header: 'Who', render: (row) => row.user?.name ?? 'System' },
    { header: 'Action', render: (row) => <StatusChip label={row.action} tone="muted" /> },
    {
      header: 'Entity',
      render: (row) => `${row.entityType}${row.entityId ? ` #${row.entityId}` : ''}`,
    },
    {
      header: 'Changes',
      render: (row) =>
        row.newValues ? (
          <code className="text-[11px] text-ink-muted">{JSON.stringify(row.newValues)}</code>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div>
      <div>
        <AdminPageHeader title="Audit Log" description="Who changed what, and when." />
        <DataTable
          columns={columns}
          rows={rows}
          isLoading={isLoading}
          emptyMessage="No audited actions yet."
        />
      </div>
    </div>
  );
}
