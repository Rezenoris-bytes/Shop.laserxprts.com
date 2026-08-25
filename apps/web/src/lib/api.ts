import type { ApiError, ApiResponse } from '@lei/shared';
import { env } from './env';

/**
 * API client.
 *
 * The base URL is env-driven on both sides of the render boundary. Nothing in
 * this app hardcodes a hostname — moving to the production domain is a change
 * to NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SITE_URL plus DNS and TLS.
 */
const BROWSER_BASE = env.apiUrl;
// Server components talk to the API directly; in Docker this is the service
// name rather than localhost, which is why it is a separate variable.
const SERVER_BASE = (process.env.API_URL ?? BROWSER_BASE).replace(/\/+$/, '');

const base = () => (typeof window === 'undefined' ? SERVER_BASE : BROWSER_BASE);

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** ISR revalidation window for server-side reads, in seconds. */
  revalidate?: number | false;
  accessToken?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, revalidate, accessToken, headers, ...rest } = options;

  const response = await fetch(`${base()}/api/v1${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    // Refresh cookie must ride along on auth calls.
    credentials: 'include',
    ...(typeof window === 'undefined' && revalidate !== undefined
      ? { next: { revalidate: revalidate === false ? 0 : revalidate } }
      : {}),
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (payload as ApiError | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.fields,
      error?.requestId,
    );
  }

  return (payload as ApiResponse<T>).data;
}

/**
 * Catalogue pages are ISR with a one-hour window rather than SSR on every
 * request: the content changes a few times a week, and rendering it per request
 * burns CPU on the same box as MySQL. Freshness comes from on-demand
 * revalidation when a product is saved.
 */
const CATALOGUE_TTL = 3600;

export const api = {
  home: () => request<HomePayload>('/home', { revalidate: CATALOGUE_TTL }),

  categories: () => request<CategoryNode[]>('/categories', { revalidate: CATALOGUE_TTL }),

  category: (slug: string) =>
    request<CategoryDetail>(`/categories/${encodeURIComponent(slug)}`, {
      revalidate: CATALOGUE_TTL,
    }),

  products: (query: Record<string, string | number | undefined>) =>
    request<ProductCard[]>(`/products?${toQuery(query)}`, { revalidate: 300 }),

  productsWithMeta: async (query: Record<string, string | number | undefined>) => {
    const response = await fetch(`${base()}/api/v1/products?${toQuery(query)}`, {
      ...(typeof window === 'undefined' ? { next: { revalidate: 300 } } : {}),
    });
    if (!response.ok)
      throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'Failed to load products');
    return (await response.json()) as { data: ProductListing[]; meta: ListMeta };
  },

  product: (slug: string) =>
    request<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
      revalidate: CATALOGUE_TTL,
    }),

  facets: (category?: string) =>
    request<Facet[]>(`/facets${category ? `?category=${encodeURIComponent(category)}` : ''}`, {
      revalidate: CATALOGUE_TTL,
    }),

  machineTree: () => request<MachineBrandNode[]>('/machines/tree', { revalidate: CATALOGUE_TTL }),

  search: async (q: string, page = 1) => {
    const response = await fetch(
      `${base()}/api/v1/search?${toQuery({ q, page })}`,
      // Search is genuinely dynamic and is noindexed; never cache it.
      { cache: 'no-store' },
    );
    if (!response.ok) throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'Search failed');
    return (await response.json()) as {
      data: ProductCard[];
      meta: ListMeta & { matchType: string };
    };
  },

  searchAutocomplete: async (q: string) => {
    if (!q.trim()) return { data: [] };
    const response = await fetch(
      `${base()}/api/v1/search/autocomplete?${toQuery({ q })}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return { data: [] };
    return (await response.json()) as { data: AutocompleteSuggestion[] };
  },

  /** Basket rehydration. Prices always come from here, never from storage. */
  resolveVariants: (ids: number[]) =>
    request<ResolvedBasket>(`/variants/resolve?ids=${ids.join(',')}`, { cache: 'no-store' }),

  submitQuoteRequest: (body: unknown) =>
    request<{ publicRef: string; itemCount: number }>('/enquiries', {
      method: 'POST',
      body,
    }),

  submitContactForm: (body: unknown) =>
    request<{ publicRef: string }>('/contact', {
      method: 'POST',
      body,
    }),

  login: (email: string, password: string) =>
    request<{ user: AdminUser; accessToken: string; expiresIn: number }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  refresh: () =>
    request<{ user: AdminUser; accessToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  adminEnquiries: (accessToken: string, query: Record<string, string | number | undefined> = {}) =>
    request<AdminEnquiryRow[]>(`/admin/enquiries?${toQuery(query)}`, {
      accessToken,
      cache: 'no-store',
    }),

  adminEnquiry: (accessToken: string, id: number) =>
    request<AdminEnquiryDetail>(`/admin/enquiries/${id}`, { accessToken, cache: 'no-store' }),

  /**
   * Storefront contact details, sourced from the admin Settings page. Short
   * revalidation window so a phone/email change goes live within minutes
   * without needing a rebuild.
   */
  contact: () => request<PublicContact>('/settings/contact', { revalidate: 300 }),
};

export interface PublicContact {
  phone: string;
  email: string;
  whatsappNumber: string;
  address: string;
  city: string;
  gstin: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

// ── Response shapes ─────────────────────────────────────────────────────────

export interface ListMeta {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  variantCount: number;
  /** The variant a card-level quote request is raised against. */
  defaultVariant: { id: number; minOrderQty: number } | null;
  isSeedData: boolean;
  category: { name: string; slug: string } | null;
  brand: { name: string; slug: string } | null;
  image: { storedName: string; path: string; alt: string | null } | null;
  /** Product-level specifications, ordered, for the listing row's spec table. */
  specs: Array<{ name: string; slug: string; value: string; unit: string | null }>;
}

/**
 * A catalogue row.
 *
 * Products have no page of their own, so a row carries everything a product
 * page used to. A superset of ProductCard, which the homepage, search and
 * related strips still use in its cheaper form.
 */
export interface ProductListing extends ProductCard {
  description: string | null;
  images: Array<{
    id: number;
    alt: string | null;
    isPrimary: boolean;
    storedName: string;
    path: string;
    width: number | null;
    height: number | null;
  }>;
  axes: Array<{ slug: string; name: string; unit: string | null; values: string[] }>;
  variants: ProductVariantView[];
}

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  description: string | null;
  productCount: number;
  /** Up to five product links for the sidebar's expanded panel. */
  products: Array<{ name: string; slug: string }>;
  /** Taken from the first product in the category; categories have no artwork. */
  image: { storedName: string; path: string } | null;
  children: CategoryNode[];
}

export interface CategoryDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  seoIndexable: boolean;
  parent: { name: string; slug: string } | null;
  children: Array<{ id: number; name: string; slug: string; productCount: number }>;
}

export interface ProductVariantView {
  id: number;
  sku: string;
  partNumber: string;
  mpn: string | null;
  name: string;
  price: number | null;
  priceType: 'FIXED' | 'ON_REQUEST' | 'CONTACT_SALES';
  mrp: number | null;
  unitOfMeasure: string;
  packSize: number;
  minOrderQty: number;
  leadTimeDays: number | null;
  isDefault: boolean;
  axisValues: Record<string, string>;
  specs: Array<{ name: string; slug: string; value: string; unit: string | null }>;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  productType: string;
  priceRange: { min: number | null; max: number | null };
  isSeedData: boolean;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    indexable: boolean;
  };
  category: {
    id: number;
    name: string;
    slug: string;
    parent: { name: string; slug: string } | null;
  } | null;
  brand: { id: number; name: string; slug: string } | null;
  images: Array<{
    id: number;
    alt: string | null;
    isPrimary: boolean;
    storedName: string;
    path: string;
    width: number | null;
    height: number | null;
  }>;
  specs: Array<{ name: string; slug: string; value: string; unit: string | null }>;
  axes: Array<{ slug: string; name: string; unit: string | null; values: string[] }>;
  variants: ProductVariantView[];
  compatibility: Array<{
    id: number;
    variantId: number | null;
    brand: { id: number; name: string; slug: string };
    model: { id: number; name: string; slug: string };
    machineVariant: { id: number; name: string; powerWatts: number | null } | null;
    notes: string | null;
    isVerified: boolean;
    isSeedData: boolean;
  }>;
  related: ProductCard[];
}

export interface Facet {
  name: string;
  slug: string;
  unit: string | null;
  dataType: string;
  isNumeric: boolean;
  values: string[];
}

export interface MachineBrandNode {
  id: number;
  name: string;
  slug: string;
  models: Array<{
    id: number;
    name: string;
    slug: string;
    variants: Array<{
      id: number;
      name: string;
      laserType: string | null;
      powerWatts: number | null;
    }>;
  }>;
}

export interface HomePayload {
  categories: CategoryNode[];
  featured: ProductCard[];
  topProducts: ProductCard[];
}

export interface ResolvedBasketItem {
  id: number;
  sku: string;
  partNumber: string;
  name: string;
  price: number | null;
  priceType: string;
  unitOfMeasure: string;
  packSize: number;
  minOrderQty: number;
  product: {
    id: number;
    name: string;
    slug: string;
    category: { name: string; slug: string } | null;
    image: string | null;
  };
}

export interface ResolvedBasket {
  items: ResolvedBasketItem[];
  unavailable: number[];
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'OWNER';
  mustChangePassword: boolean;
}

export interface AdminEnquiryRow {
  id: number;
  publicRef: string;
  status: string;
  priority: string;
  contactName: string;
  contactCompany: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  isSeedData: boolean;
  assignedTo: { id: number; name: string } | null;
  _count: { items: number };
}

export interface AdminEnquiryDetail extends AdminEnquiryRow {
  message: string | null;
  contactCity: string | null;
  consentGiven: boolean;
  consentText: string | null;
  spamScore: number;
  items: Array<{
    id: number;
    productNameSnapshot: string | null;
    partNumberSnapshot: string | null;
    unitPriceSnapshot: string | null;
    quantity: number;
    customerNote: string | null;
    variant: {
      id: number;
      sku: string;
      partNumber: string;
      product: { name: string; slug: string };
    } | null;
  }>;
  customer: { id: number; companyName: string | null; contactName: string; status: string } | null;
}

export interface AutocompleteSuggestion {
  id: number;
  name: string;
  slug: string;
  image: { storedName: string; path: string } | null;
}
