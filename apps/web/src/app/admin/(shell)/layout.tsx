'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRequireAdmin } from '@/lib/admin-auth';
import { adminNav } from '@/lib/admin-nav';

/**
 * Authenticated shell — sidebar nav plus the current admin's identity.
 *
 * Everything under (shell) is gated by useRequireAdmin, which redirects to
 * /admin/login before this renders anything sensitive. The route group has no
 * URL segment of its own; it exists purely to share this layout.
 */
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const auth = useRequireAdmin();
  const pathname = usePathname();

  if (auth.status !== 'authenticated' || !auth.user) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-wash">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  const visibleNav = adminNav.filter(
    (item) => item.module === null || auth.hasPermission(item.module, 'view'),
  );

  return (
    <div className="flex min-h-screen bg-ink-wash">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-line bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-ink-line px-5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-xs font-black text-amber">
            LEI
          </span>
          <span className="text-sm font-bold">Admin</span>
        </div>

        <nav aria-label="Admin" className="flex-1 space-y-0.5 p-3">
          {visibleNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-ink text-white' : 'text-ink hover:bg-ink-wash',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-line p-3">
          <p className="truncate text-xs font-semibold">{auth.user.name}</p>
          <p className="truncate text-[11px] text-ink-muted">
            {auth.user.role === 'SUPER_ADMIN' ? 'Super Admin' : auth.user.department}
          </p>
          <button
            type="button"
            onClick={() => auth.logout()}
            className="mt-2 text-[11px] font-medium text-ink-muted underline hover:text-bad"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
