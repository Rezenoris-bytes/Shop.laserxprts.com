'use client';

import { useAdminAuth } from '@/lib/admin-auth';

/**
 * Client-side gate for screens the nav already hides from most roles.
 *
 * The API is the real authority — every route here 403s server-side
 * regardless of what this component does. Without this gate, though, a user
 * who reaches the URL directly (bookmark, back button, typed address) sees a
 * page header over a silently empty table, which reads as "there is nothing
 * here" rather than "you are not allowed to see this" — a materially
 * different, and misleading, message.
 */
export function PermissionGate({
  module,
  action = 'view',
  children,
}: {
  module: string;
  action?: 'view' | 'create' | 'update' | 'delete';
  children: React.ReactNode;
}) {
  const auth = useAdminAuth();

  if (auth.status !== 'authenticated') return null;

  if (!auth.hasPermission(module, action)) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="text-sm font-semibold">You don&apos;t have access to this section</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          This area is restricted. Contact your Super Admin if you need access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
