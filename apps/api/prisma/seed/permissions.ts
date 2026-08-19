import { AdminDepartment, PermissionModule } from '@lei/shared';

type Grant = { view?: boolean; create?: boolean; update?: boolean; delete?: boolean };

/**
 * Default permission templates per department.
 *
 * These are TEMPLATES, not rules. The Super Admin picks a department when
 * creating an admin, these values pre-fill the permission form, and the saved
 * `admin_permissions` rows are what the guard actually reads. Nothing at
 * runtime consults `User.department` — two sources of authorization truth
 * inevitably diverge.
 *
 * Note what SALES does NOT get: catalogue writes, users, audit, settings.
 * And what CATALOGUE does NOT get: customers, enquiries, quotes. That second
 * boundary is the PII one, and it is the one worth checking in review.
 */
export const DEPARTMENT_TEMPLATES: Record<
  AdminDepartment,
  Partial<Record<PermissionModule, Grant>>
> = {
  SALES: {
    CUSTOMERS: { view: true, create: true, update: true },
    ENQUIRIES: { view: true, update: true },
    LEADS: { view: true, create: true, update: true },
    QUOTES: { view: true, create: true, update: true },
    ORDERS: { view: true, update: true },
    CATALOGUE: { view: true },
    INVENTORY: { view: true },
    MACHINES: { view: true },
    REPORTS: { view: true },
  },

  SERVICE: {
    CUSTOMERS: { view: true, update: true },
    SERVICES: { view: true, update: true },
    SERVICE_REQUESTS: { view: true, create: true, update: true },
    MACHINES: { view: true, create: true, update: true },
    QUOTES: { view: true, create: true },
    LEADS: { view: true, update: true },
    CATALOGUE: { view: true },
    REPORTS: { view: true },
  },

  CATALOGUE: {
    CATALOGUE: { view: true, create: true, update: true, delete: true },
    INVENTORY: { view: true, create: true, update: true },
    MACHINES: { view: true, create: true, update: true, delete: true },
    REPORTS: { view: true },
    // Deliberately no CUSTOMERS / ENQUIRIES / QUOTES — a catalogue manager
    // has no business reason to read customer PII.
  },

  CONTENT: {
    CATALOGUE: { view: true, update: true },
    SERVICES: { view: true, update: true },
    REPORTS: { view: true },
  },

  OPERATIONS: {
    ORDERS: { view: true, create: true, update: true },
    INVENTORY: { view: true, create: true, update: true },
    ENQUIRIES: { view: true, update: true },
    CUSTOMERS: { view: true },
    CATALOGUE: { view: true },
    REPORTS: { view: true },
  },
};

export function expandTemplate(department: AdminDepartment) {
  const template = DEPARTMENT_TEMPLATES[department];
  return Object.entries(template).map(([module, grant]) => ({
    module: module as PermissionModule,
    canView: grant.view ?? false,
    canCreate: grant.create ?? false,
    canUpdate: grant.update ?? false,
    canDelete: grant.delete ?? false,
  }));
}
