/**
 * Admin navigation items.
 *
 * All routes are visible to any authenticated OWNER — the module field is kept
 * for future use but is always null so the layout never hides anything.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  module: null;
}

export const adminNav: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', module: null },
  { label: 'Enquiries', href: '/admin/enquiries', module: null },
  { label: 'Products', href: '/admin/products', module: null },
  { label: 'Categories', href: '/admin/categories', module: null },
  { label: 'Part Brands', href: '/admin/part-brands', module: null },
  { label: 'Machines', href: '/admin/machines', module: null },
  { label: 'Users', href: '/admin/users', module: null },
  { label: 'Audit Log', href: '/admin/audit-logs', module: null },
  { label: 'Settings', href: '/admin/settings', module: null },
];
