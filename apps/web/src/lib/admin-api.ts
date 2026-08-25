import { adminFetch, adminFetchEnveloped, adminUpload, adminDownload } from './admin-auth';
import type { AdminEnquiryDetail, AdminEnquiryRow, ListMeta } from './api';

export type { AdminEnquiryRow };

/**
 * Typed admin API surface.
 *
 * A thin layer over `adminFetch` — every call here is authenticated and
 * permission-guarded server-side; this file only shapes the requests and
 * response types so screens are not hand-rolling fetch calls.
 */

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

export interface DashboardData {
  enquiries: { new: number; called: number; confirmed: number; total: number };
  quotes: { draft: number; sent: number; expiringSoon: number };
  products: { active: number; inactive: number };
  searchNoResults: Array<{ normalized: string; count: number }>;
  demoData: Record<string, number>;
  placeholderSettings: string[];
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  isSeedData: boolean;
  parent: { name: string } | null;
}

export interface AdminPartBrand {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  isSeedData: boolean;
}

export interface AdminProductRow {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
  hasStock: boolean;
  minPrice: string | null;
  maxPrice: string | null;
  isSeedData: boolean;
  category: { name: string } | null;
  partBrand: { name: string } | null;
  _count: { variants: number };
}

export interface BulkUploadResult {
  created: number;
  updated: number;
  imagesAttached: number;
  categoriesCreated: number;
  brandsCreated: number;
  errors: Array<{ row: number; message: string }>;
}

export interface AdminProductMedia {
  id: number;
  fileId: number;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  file: {
    id: number;
    storedName: string;
    path: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    originalName: string;
  };
}

export interface AdminProductDetail {
  id: number;
  categoryId: number;
  partBrandId: number | null;
  name: string;
  slug: string;
  productType: string;
  shortDescription: string | null;
  description: string | null;
  isFeatured: boolean;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  media: AdminProductMedia[];
  variants: Array<{
    id: number;
    sku: string;
    partNumber: string;
    variantName: string;
    price: string | null;
    priceType: string;
    unitOfMeasure: string;
    packSize: number;
    isDefault: boolean;
    isActive: boolean;
  }>;
  compatibility: Array<{
    id: number;
    variantId: number | null;
    isVerified: boolean;
    notes: string | null;
    machineBrand: { id: number; name: string };
    machineModel: { id: number; name: string };
    machineVariant: { id: number; name: string } | null;
  }>;
}

export interface AdminMachineBrand {
  id: number;
  name: string;
  slug: string;
  models: Array<{
    id: number;
    name: string;
    variants: Array<{
      id: number;
      name: string;
      laserType: string | null;
      powerWatts: number | null;
    }>;
  }>;
}

export interface AdminAttribute {
  id: number;
  name: string;
  slug: string;
  dataType: string;
  defaultScope: string;
  unit: string | null;
  isFilterable: boolean;
}

export interface AdminCustomerRow {
  id: number;
  companyName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: string;
  isVerified: boolean;
  isSeedData: boolean;
  createdAt: string;
  _count: { enquiries: number; quotes: number };
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: 'OWNER';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditLogRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
  user: { id: number; name: string; email: string } | null;
}

export interface AdminSetting {
  key: string;
  value: string;
  group: string;
  description: string | null;
  isSecret: boolean;
}

export const adminApi = {
  dashboard: () => adminFetch<DashboardData>('/admin/dashboard'),

  // Enquiries
  enquiries: (query: Record<string, string | number | undefined> = {}) =>
    adminFetchEnveloped<AdminEnquiryRow[]>(
      `/admin/enquiries?${toQuery(query)}`,
    ) as unknown as Promise<{
      data: AdminEnquiryRow[];
      meta: ListMeta;
    }>,
  enquiry: (id: number) => adminFetch<AdminEnquiryDetail>(`/admin/enquiries/${id}`),
  updateEnquiry: (
    id: number,
    body: { status?: string; priority?: string; assignedToId?: number | null },
  ) => adminFetch(`/admin/enquiries/${id}`, { method: 'PATCH', body }),

  // Customers
  customers: (query: Record<string, string | number | undefined> = {}) =>
    adminFetchEnveloped<AdminCustomerRow[]>(
      `/admin/customers?${toQuery(query)}`,
    ) as unknown as Promise<{
      data: AdminCustomerRow[];
      meta: ListMeta;
    }>,
  customer: (id: number) => adminFetch(`/admin/customers/${id}`),
  updateCustomer: (id: number, body: Record<string, unknown>) =>
    adminFetch(`/admin/customers/${id}`, { method: 'PATCH', body }),

  // Categories
  categories: () => adminFetch<AdminCategory[]>('/admin/categories'),
  createCategory: (body: Record<string, unknown>) =>
    adminFetch<AdminCategory>('/admin/categories', { method: 'POST', body }),
  updateCategory: (id: number, body: Record<string, unknown>) =>
    adminFetch<AdminCategory>(`/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: number) => adminFetch(`/admin/categories/${id}`, { method: 'DELETE' }),

  // Part brands
  partBrands: () => adminFetch<AdminPartBrand[]>('/admin/part-brands'),
  createPartBrand: (body: Record<string, unknown>) =>
    adminFetch<AdminPartBrand>('/admin/part-brands', { method: 'POST', body }),
  updatePartBrand: (id: number, body: Record<string, unknown>) =>
    adminFetch<AdminPartBrand>(`/admin/part-brands/${id}`, { method: 'PATCH', body }),

  // Products
  products: (query: Record<string, string | number | undefined> = {}) =>
    adminFetchEnveloped<AdminProductRow[]>(
      `/admin/products?${toQuery(query)}`,
    ) as unknown as Promise<{
      data: AdminProductRow[];
      meta: ListMeta;
    }>,
  product: (id: number) => adminFetch<AdminProductDetail>(`/admin/products/${id}`),
  createProduct: (body: Record<string, unknown>) =>
    adminFetch<AdminProductDetail>('/admin/products', { method: 'POST', body }),
  updateProduct: (id: number, body: Record<string, unknown>) =>
    adminFetch<AdminProductDetail>(`/admin/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id: number) => adminFetch(`/admin/products/${id}`, { method: 'DELETE' }),

  // ── Bulk upload ──────────────────────────────────────────────────────
  bulkUploadProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return adminUpload<BulkUploadResult>('/admin/products/bulk-upload', form);
  },
  bulkUploadTemplate: () => adminDownload('/admin/products/bulk-upload/template'),

  // ── Product media ───────────────────────────────────────────────────
  productMedia: (id: number) => adminFetch<AdminProductMedia[]>(`/admin/products/${id}/media`),

  uploadProductMedia: (id: number, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return adminUpload<{
      added: number;
      failures: Array<{ filename: string; message: string }>;
      media: AdminProductMedia[];
    }>(`/admin/products/${id}/media`, form);
  },

  setPrimaryProductMedia: (id: number, mediaId: number) =>
    adminFetch<AdminProductMedia[]>(`/admin/products/${id}/media/${mediaId}/primary`, {
      method: 'PATCH',
    }),

  reorderProductMedia: (id: number, mediaIds: number[]) =>
    adminFetch<AdminProductMedia[]>(`/admin/products/${id}/media/order`, {
      method: 'PATCH',
      body: { mediaIds },
    }),

  replaceProductMedia: (id: number, mediaId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return adminUpload<AdminProductMedia[]>(`/admin/products/${id}/media/${mediaId}/replace`, form);
  },

  deleteProductMedia: (id: number, mediaId: number) =>
    adminFetch<AdminProductMedia[]>(`/admin/products/${id}/media/${mediaId}`, { method: 'DELETE' }),

  // Variants
  createVariant: (body: Record<string, unknown>) =>
    adminFetch('/admin/variants', { method: 'POST', body }),
  updateVariant: (id: number, body: Record<string, unknown>) =>
    adminFetch(`/admin/variants/${id}`, { method: 'PATCH', body }),
  deleteVariant: (id: number, productId: number) =>
    adminFetch(`/admin/variants/${id}?productId=${productId}`, { method: 'DELETE' }),

  stockMovements: (id: number) => adminFetch(`/admin/variants/${id}/stock-movements`),

  // Compatibility
  createCompatibility: (body: Record<string, unknown>) =>
    adminFetch('/admin/compatibility', { method: 'POST', body }),
  verifyCompatibility: (id: number) =>
    adminFetch(`/admin/compatibility/${id}/verify`, { method: 'PATCH' }),
  deleteCompatibility: (id: number) =>
    adminFetch(`/admin/compatibility/${id}`, { method: 'DELETE' }),

  // Machines
  machines: () => adminFetch<AdminMachineBrand[]>('/admin/machines'),
  createMachineBrand: (name: string) =>
    adminFetch('/admin/machines/brands', { method: 'POST', body: { name } }),
  createMachineModel: (machineBrandId: number, name: string) =>
    adminFetch('/admin/machines/models', { method: 'POST', body: { machineBrandId, name } }),
  createMachineVariant: (
    machineModelId: number,
    name: string,
    laserType?: string,
    powerWatts?: number,
  ) =>
    adminFetch('/admin/machines/variants', {
      method: 'POST',
      body: { machineModelId, name, laserType, powerWatts },
    }),

  // Attributes
  attributes: () => adminFetch<AdminAttribute[]>('/admin/attributes'),
  createAttribute: (body: Record<string, unknown>) =>
    adminFetch('/admin/attributes', { method: 'POST', body }),

  // Users
  users: () => adminFetch<AdminUserRow[]>('/admin/users'),
  createUser: (body: { name: string; email: string }) =>
    adminFetch<{ user: AdminUserRow; temporaryPassword: string }>('/admin/users', {
      method: 'POST',
      body,
    }),
  activateUser: (id: number) => adminFetch(`/admin/users/${id}/activate`, { method: 'PATCH' }),
  deactivateUser: (id: number) => adminFetch(`/admin/users/${id}/deactivate`, { method: 'PATCH' }),

  // Audit
  auditLogs: (query: Record<string, string | number | undefined> = {}) =>
    adminFetchEnveloped<AuditLogRow[]>(
      `/admin/audit-logs?${toQuery(query)}`,
    ) as unknown as Promise<{
      data: AuditLogRow[];
      meta: { pagination: { page: number; perPage: number; total: number } };
    }>,

  // Settings
  settings: () => adminFetch<AdminSetting[]>('/admin/settings'),
  updateSetting: (key: string, value: string) =>
    adminFetch(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PATCH', body: { value } }),
};
