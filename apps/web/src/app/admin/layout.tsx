import { AdminAuthProvider } from '@/lib/admin-auth';

/**
 * Admin root layout.
 *
 * Deliberately outside the storefront's layout.tsx (no header, footer, or
 * Quote Request drawer) — the admin panel is an internal tool, not a
 * public-facing route, and CSR throughout since it has no SEO value.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
