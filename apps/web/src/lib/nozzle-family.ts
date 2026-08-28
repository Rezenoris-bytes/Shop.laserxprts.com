/**
 * Nozzle Family — types and API helper.
 *
 * These types mirror the NozzleFamilyService response from the backend.
 * No logic here: all grouping happens on the server; this file is pure types
 * + the fetch call.
 */

/**
 * Category slugs presented as grouped families (one card per family, with
 * Layer/Cut Type/Size selectors) instead of one flat row per DB product.
 *
 * Re-exported from @lei/shared, not defined here — the API's category-tree
 * sidebar preview needs the exact same set (a parent category borrows sample
 * products from its descendants, and a family-view descendant must be
 * excluded from that borrowing too, or an individual product name leaks into
 * an ancestor's quick-link panel). Two independently-maintained copies is
 * exactly how that leak happened the first time.
 */
export { FAMILY_VIEW_CATEGORY_SLUGS as FAMILY_VIEW_CATEGORIES } from '@lei/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A resolved leaf — always maps 1-to-1 to one DB variant and SKU. */
export interface NozzleVariantLeaf {
  variantId: number;
  /** Original DB variantName — never modified. */
  variantName: string;
  /** Numeric orifice size as a display label, e.g. "1.2". */
  size: string;
  priceType: string;
  price: string | null;
  minOrderQty: number;
}

/** One selectable dimension derived from the data. */
export interface OptionGroup {
  /** Machine-readable key used in option selection state, e.g. "layer". */
  key: string;
  /** Human label shown in the UI, e.g. "Layer". */
  label: string;
  /** Ordered distinct values, e.g. ["Single Layer", "Double Layer"]. */
  values: string[];
}

/**
 * A family card shown in the storefront.
 * Groups multiple DB products (e.g. Single + Double layer) into one UI element.
 */
export interface ProductFamily {
  familyKey: string;
  familyName: string;
  brand: string | null;
  brandSlug: string | null;
  /** Head diameter, e.g. "D32". Null when absent from the product names. */
  diameter: string | null;
  /** Slug of the first/representative DB product — used for detail page links. */
  slug: string;
  shortDescription: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  /** Option dimensions available for this family (only when ≥ 2 distinct values). */
  optionGroups: OptionGroup[];
  /**
   * Key → variant lookup.
   * Key format: "layer=Single Layer|cutType=Standard|size=1.2"
   * Only axes that appear in optionGroups contribute to the key.
   */
  variantMap: Record<string, NozzleVariantLeaf>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch product families for a given category slug.
 * Used server-side in the catalogue page — runs during SSR/ISR.
 */
export async function fetchProductFamilies(
  categorySlug: string,
  apiBase: string,
): Promise<ProductFamily[]> {
  const base = apiBase.replace(/\/+$/, '');
  const res = await fetch(
    `${base}/api/v1/products/families?category=${encodeURIComponent(categorySlug)}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: ProductFamily[] } | ProductFamily[];
  // Handle both enveloped { data: [...] } and bare [...] response shapes
  return Array.isArray(json) ? json : (json.data ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build the option-key string that indexes into variantMap. */
export function buildOptionKey(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}

/**
 * Given the current option selections, return the resolved leaf or null
 * if the combination is not valid.
 */
export function resolveVariant(
  family: ProductFamily,
  selections: Record<string, string>,
): NozzleVariantLeaf | null {
  const key = buildOptionKey(selections);
  return family.variantMap[key] ?? null;
}

/**
 * Returns true if a given value for a given axis is available at all,
 * given the already-selected values on the other axes.
 *
 * Used to disable option buttons when a combination doesn't exist.
 */
export function isOptionAvailable(
  family: ProductFamily,
  axis: string,
  value: string,
  currentSelections: Record<string, string>,
): boolean {
  const candidate = { ...currentSelections, [axis]: value };
  // Check if ANY variant key in the map matches the candidate (partial match on active axes)
  const testKey = buildOptionKey(candidate);
  // Exact match
  if (family.variantMap[testKey]) return true;
  // Partial match: if the candidate is a prefix of any key
  const prefix = testKey + '|';
  return Object.keys(family.variantMap).some(
    (k) => k === testKey || k.startsWith(prefix),
  );
}
