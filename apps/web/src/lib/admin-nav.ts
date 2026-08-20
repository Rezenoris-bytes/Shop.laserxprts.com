/**
 * Admin navigation, filtered by permission at render time.
 *
 * Driven by the SAME `admin_permissions` payload the API guard reads,
 * delivered once at login — never re-derived by guessing what a department
 * "should" see. Hiding what a user cannot access, rather than showing an
 * error on click, is the whole point of gating the nav at all.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  module: string | null; // null = visible to any authenticated admin
}

export const adminNav: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', module: 'REPORTS' },
  { label: 'Enquiries', href: '/admin/enquiries', module: 'ENQUIRIES' },
  { label: 'Customers', href: '/admin/customers', module: 'CUSTOMERS' },
  { label: 'Products', href: '/admin/products', module: 'CATALOGUE' },
  { label: 'Categories', href: '/admin/categories', module: 'CATALOGUE' },
  { label: 'Part Brands', href: '/admin/part-brands', module: 'CATALOGUE' },
  { label: 'Machines', href: '/admin/machines', module: 'MACHINES' },
  { label: 'Users & Permissions', href: '/admin/users', module: 'USERS' },
  { label: 'Audit Log', href: '/admin/audit-logs', module: 'AUDIT' },
  { label: 'Settings', href: '/admin/settings', module: 'SETTINGS' },
];
