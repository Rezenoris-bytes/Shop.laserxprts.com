/**
 * Normalisation helpers.
 *
 * These live in the shared package because several of them MUST produce
 * identical output on the write path and the read path. If `normalizeSearchKey`
 * were duplicated, an index written by the importer would stop matching a query
 * built by the search endpoint — and the failure would be silent.
 */

/**
 * Builds the value stored in `ProductVariant.searchKey` and the value a search
 * query is converted to before matching against it.
 *
 * Laser part numbers are punctuation-heavy and full of short tokens:
 *   "D27.9 T4.1"  "M11 H15"  "D1.0 H15"
 *
 * MySQL FULLTEXT splits on punctuation and discards tokens shorter than
 * `innodb_ft_min_token_size`, so "D27.9 T4.1" degrades to a search for "D27"
 * and returns nothing useful. Stripping to alphanumerics and matching exactly
 * or by prefix against an indexed column solves that completely.
 *
 *   normalizeSearchKey("D27.9 T4.1")  ->  "D279T41"
 *   normalizeSearchKey("d27-9 t4/1")  ->  "D279T41"   (same key, as intended)
 */
export function normalizeSearchKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Builds the composite search key for a variant. Order matters: part number
 * first, because an exact part-number match is the highest-confidence result.
 */
export function buildVariantSearchKey(parts: {
  partNumber?: string | null;
  sku?: string | null;
  variantName?: string | null;
  productName?: string | null;
}): string {
  return [parts.partNumber, parts.sku, parts.variantName, parts.productName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeSearchKey)
    .filter((value) => value.length > 0)
    .join(' ');
}

/**
 * Email match key for customer find-or-create.
 * Stored in `Customer.emailNormalized` so the lookup uses an index instead of
 * applying LOWER() to every row.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Phone match key for customer find-or-create. Produces E.164 for Indian
 * numbers, and a best-effort digits-only form otherwise.
 *
 *   "98765 43210"     -> "+919876543210"
 *   "+91 98765-43210" -> "+919876543210"
 *   "091 9876543210"  -> "+919876543210"
 *
 * Returns null when the input cannot be a usable phone number, so the caller
 * can fall back to email matching rather than creating a junk match key.
 */
export function normalizePhone(phone: string, defaultCountryCode = '91'): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;

  // Already carries the country code.
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }
  // Leading zeros / trunk prefixes.
  const trimmed = digits.replace(/^0+/, '');
  if (trimmed.length === 12 && trimmed.startsWith(defaultCountryCode)) {
    return `+${trimmed}`;
  }
  if (trimmed.length === 10) {
    return `+${defaultCountryCode}${trimmed}`;
  }
  // Unrecognised shape — keep it, but in a consistent form.
  return `+${trimmed}`;
}

/**
 * URL slug. Used for categories, products, brands and machine models.
 * Deliberately conservative: ASCII only, no consecutive or trailing hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 190);
}

