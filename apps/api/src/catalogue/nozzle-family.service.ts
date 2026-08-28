import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrored in the web app's lib/nozzle-family.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface NozzleVariantLeaf {
  variantId: number;
  /**
   * NOTE: sku is deliberately absent. It is an internal code (§21) and
   * nothing on the storefront renders it — but anything in this payload is
   * readable in the page source, so it must not be sent at all.
   */
  /** Original DB variantName — NEVER modified */
  variantName: string;
  /** Numeric orifice diameter as display label, e.g. "1.2" */
  size: string;
  priceType: string;
  price: string | null;
  minOrderQty: number;
}

export interface OptionGroup {
  /** Machine-readable key, e.g. "layer", "cutType", "size" */
  key: string;
  /** Human label shown in the UI, e.g. "Layer" */
  label: string;
  /** Ordered distinct values available in this family, e.g. ["Single Layer","Double Layer"] */
  values: string[];
}

export interface ProductFamily {
  familyKey: string;
  familyName: string;
  brand: string | null;
  brandSlug: string | null;
  /** Only present when the head diameter is explicit in the product names */
  diameter: string | null;
  slug: string;
  shortDescription: string | null;
  /** Primary image from any product in the family (first one found) */
  imagePath: string | null;
  imageAlt: string | null;
  optionGroups: OptionGroup[];
  /**
   * Lookup from an option-key string to the resolved variant.
   * Key format: "layer=Single Layer|cutType=Standard|size=1.2"
   * Only axes that are present in optionGroups contribute to the key.
   */
  variantMap: Record<string, NozzleVariantLeaf>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — all pure functions, no brand-specific conditions
// ─────────────────────────────────────────────────────────────────────────────

/** Extract a diameter token such as "D28" or "D32" from a product name. */
function extractDiameter(name: string): string | null {
  const m = name.match(/\b(D\d+)\b/i);
  return m ? (m[1] ?? '').toUpperCase() || null : null;
}

/** Extract layer from a product name by looking for "Single" or "Double". */
function extractLayer(name: string): string | null {
  if (/single\s+layer/i.test(name)) return 'Single Layer';
  if (/double\s+layer/i.test(name)) return 'Double Layer';
  return null;
}

/**
 * Detect whether a product name implies "Fast" cutting.
 * Words like "Fast Cutting" in the product name indicate this.
 */
function extractCutType(name: string): string {
  return /fast/i.test(name) ? 'Fast Cutting' : 'Standard';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips brand, diameter, layer and "fast" qualifiers from a product name,
 * leaving the part that actually distinguishes ONE PHYSICAL NOZZLE TYPE from
 * another — e.g. "Cutting Nozzle", "Tube Cutting Nozzle", "Bullet Nozzle",
 * "Wax Cutting Nozzle".
 *
 * This is the single source of truth for BOTH the family key and the family
 * name, so a card and its grouping key can never disagree about what a
 * family actually is. Before this existed, familyKeyFor always appended the
 * literal string "cutting-nozzle" regardless of the remaining product name —
 * which silently merged "Bullet Nozzle" and "Tube Cutting Nozzle" into one
 * family the moment both had no brand and no diameter. Different core types
 * are genuinely different products (see module docblock §7) and must never
 * collapse into the same card just because they lack a brand prefix.
 */
function coreProductType(
  productName: string,
  brandName: string | null,
  diameter: string | null,
): string {
  let base = productName
    .replace(/\b(single|double)\s+layer\b/gi, '')
    .replace(/\bfast\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (brandName) {
    base = base.replace(new RegExp(`^${escapeRegExp(brandName)}\\s*`, 'i'), '').trim();
  }
  if (diameter) {
    base = base.replace(new RegExp(`\\b${escapeRegExp(diameter)}\\b`, 'i'), '').trim();
  }

  base = base.replace(/\s{2,}/g, ' ').trim();
  return base || 'Cutting Nozzle';
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Compute the canonical family key for a product, used to group products
 * into a single family card.
 *
 * Formula: {brandSlug}-{diameter|''}-{core-type}
 * Works for every brand without any brand-specific logic, and — unlike the
 * previous version — cannot merge two differently-named unbranded products.
 */
function familyKeyFor(brandSlug: string | null, brandName: string | null, productName: string): string {
  const diam = extractDiameter(productName);
  const core = coreProductType(productName, brandName, diam);
  const parts: string[] = [];
  if (brandSlug) parts.push(brandSlug);
  if (diam) parts.push(diam.toLowerCase());
  parts.push(slugify(core));
  return parts.join('-');
}

/**
 * Compute a human-readable family name from brand + diameter + core type,
 * stripping "Single/Double Layer" and "Fast/Standard" — those become option
 * groups instead of separate cards.
 *
 * Example: "RayTools D32 Cutting Nozzle", "Amada Cutting Nozzle",
 * "Amada Wax Cutting Nozzle", "Tube Cutting Nozzle".
 */
function familyNameFor(
  brandName: string | null,
  productName: string,
  diameter: string | null,
): string {
  const core = coreProductType(productName, brandName, diameter);
  const parts: string[] = [];
  if (brandName) parts.push(brandName);
  if (diameter) parts.push(diameter);
  parts.push(core);
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Derive the orifice size label from a variant's variantName.
 * Handles forms like: "1.2 mm", "0.8E", "D1.2", "1.4", "2.0 H15"
 * Returns e.g. "1.2", "0.8", or the original if no numeric found.
 */
function extractSize(variantName: string): string {
  const stripped = variantName.replace(/^D/i, '');
  const m = stripped.match(/(\d+(?:\.\d+)?)/);
  return m && m[1] ? m[1] : variantName.trim();
}

/**
 * Collision-safe size labelling for one product's variant list.
 *
 * Two families of variant naming show up in this data:
 *
 *  - Clean lines (RayTools, Precitec, Bodor, DNE): "0.8 mm", "1.0 mm" for the
 *    Standard product and "0.8E", "1.0E" for its Fast Cutting sibling. Each
 *    reduces to a bare "0.8" with no collision WITHIN either product, so the
 *    bare number is used — and because both products land in the same size
 *    Set, Standard and Fast share one "0.8" size button, with the separate
 *    Cut Type selector distinguishing them. That is the correct shape: 14
 *    size buttons, not 28 duplicates of "X mm" / "XE".
 *
 *  - Amada's naming encodes more than diameter — "D1.2 D W/I", "D1.2 D W/O"
 *    and "D1.2FE" all reduce to the same bare "1.2" and are three distinct,
 *    real SKUs, not one size spelled three ways. Collapsing them would make
 *    two of the three unselectable (last write wins in the variant map).
 *
 * So: use the bare number only when it's unique within THIS product's own
 * variant list; the moment two variants in the same product would collide,
 * every variant in that product falls back to its full (D-stripped) name
 * instead, so nothing is ever dropped.
 */
function sizeLabelsFor(variantNames: string[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const name of variantNames) {
    const size = extractSize(name);
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  const labels = new Map<string, string>();
  for (const name of variantNames) {
    const size = extractSize(name);
    labels.set(name, (counts.get(size) ?? 0) > 1 ? name.replace(/^D/i, '').trim() : size);
  }
  return labels;
}

/** Numeric sort key for a size label, tolerant of the non-numeric-led fallback labels sizeLabelsFor() can produce. */
function sizeSortValue(label: string): number {
  const m = label.replace(/^D/i, '').match(/(\d+(?:\.\d+)?)/);
  return m && m[1] ? parseFloat(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** Build an option-key string from the resolved option values. */
function buildOptionKey(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class NozzleFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all product families in a given category slug.
   *
   * "Family" means a group of related DB products (e.g. Single Layer + Double
   * Layer from the same brand) presented as one card with option selectors.
   */
  async getFamilies(categorySlug: string): Promise<ProductFamily[]> {
    // 1. Fetch all products in the category with their variants
    const products = await this.prisma.client.product.findMany({
      where: {
        isActive: true,
        category: { slug: categorySlug },
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        partBrand: { select: { name: true, slug: true } },
        media: {
          where: { isPrimary: true },
          take: 1,
          select: {
            altText: true,
            file: { select: { path: true } },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            variantName: true,
            price: true,
            priceType: true,
            minOrderQty: true,
          },
        },
        // A product-level "Size" spec (added for products like O-Rings /
        // Sealing Rings, which are one product per size rather than one
        // product with many size variants — see the size-labelling note
        // below for how this changes the axis computation).
        attributeValues: {
          where: { attribute: { slug: 'size' } },
          select: { valueString: true },
          take: 1,
        },
      },
    });

    // 2. Group products into family buckets by familyKey
    const buckets = new Map<
      string,
      {
        familyKey: string;
        brandName: string | null;
        brandSlug: string | null;
        diameter: string | null;
        slug: string;
        shortDescription: string | null;
        imagePath: string | null;
        imageAlt: string | null;
        productName: string; // representative name (first in bucket)
        rows: Array<{
          product: (typeof products)[0];
          layer: string | null;
          cutType: string;
        }>;
      }
    >();

    for (const product of products) {
      const brandName = product.partBrand?.name ?? null;
      const brandSlug = product.partBrand?.slug ?? null;
      const diameter = extractDiameter(product.name);
      const layer = extractLayer(product.name);
      const cutType = extractCutType(product.name);
      const fKey = familyKeyFor(brandSlug, brandName, product.name);

      if (!buckets.has(fKey)) {
        const imagePath = product.media[0]?.file?.path ?? null;
        const imageAlt = product.media[0]?.altText ?? null;
        buckets.set(fKey, {
          familyKey: fKey,
          brandName,
          brandSlug,
          diameter,
          slug: product.slug, // use first product slug as family anchor
          shortDescription: product.shortDescription,
          imagePath,
          imageAlt,
          productName: product.name,
          rows: [],
        });
      }

      const bucket = buckets.get(fKey)!;
      // Take the first image found in the family
      if (!bucket.imagePath && product.media[0]?.file?.path) {
        bucket.imagePath = product.media[0].file.path;
        bucket.imageAlt = product.media[0].altText ?? null;
      }

      bucket.rows.push({ product, layer, cutType });
    }

    // 3. For each bucket, build option groups + variantMap
    const families: ProductFamily[] = [];

    for (const bucket of buckets.values()) {
      // Collision-safe size label per product (see sizeLabelsFor docblock) —
      // computed once per product so both passes below agree on the label.
      //
      // Two different shapes of "size" exist in this catalogue:
      //
      //  - Nozzles: ONE product, MANY size variants ("0.8 mm", "1.0 mm", ...).
      //    The size lives in variantName, so sizeLabelsFor() extracts it.
      //
      //  - O-Rings / Sealing Rings: ONE product PER size, each holding a
      //    single "Standard" variant. The size lives on the PRODUCT, as a
      //    dedicated "Size" spec (added when the name/size field swap was
      //    corrected — see fix-name-size-swap). extractSize("Standard") would
      //    return the useless literal "Standard", so a product carrying that
      //    spec uses it directly instead of inspecting the variant name.
      //
      // This is driven entirely by what data each product actually has, not
      // by category or product type, so nothing here is O-Ring-specific: any
      // future one-size-per-product category picks this up automatically the
      // moment its products carry the Size spec.
      const sizeLabelsByProduct = new Map<number, Map<string, string>>();
      for (const { product } of bucket.rows) {
        const productSize = product.attributeValues[0]?.valueString;
        if (productSize && product.variants.length === 1) {
          const only = product.variants[0]!;
          sizeLabelsByProduct.set(product.id, new Map([[only.variantName, productSize]]));
        } else {
          sizeLabelsByProduct.set(
            product.id,
            sizeLabelsFor(product.variants.map((v) => v.variantName)),
          );
        }
      }

      // Collect all distinct values for each potential axis
      const layerValues = new Set<string>();
      const cutTypeValues = new Set<string>();
      const sizeValues = new Set<string>();

      for (const { product, layer, cutType } of bucket.rows) {
        if (layer) layerValues.add(layer);
        cutTypeValues.add(cutType);
        const labels = sizeLabelsByProduct.get(product.id)!;
        for (const v of product.variants) {
          sizeValues.add(labels.get(v.variantName)!);
        }
      }

      // An axis becomes an OptionGroup only when it has ≥ 2 distinct values
      const activeAxes: string[] = [];
      const optionGroups: OptionGroup[] = [];

      if (layerValues.size >= 2) {
        activeAxes.push('layer');
        optionGroups.push({
          key: 'layer',
          label: 'Layer',
          values: ['Single Layer', 'Double Layer'].filter((v) => layerValues.has(v)),
        });
      }

      if (cutTypeValues.size >= 2) {
        activeAxes.push('cutType');
        optionGroups.push({
          key: 'cutType',
          label: 'Cut Type',
          values: ['Standard', 'Fast Cutting'].filter((v) => cutTypeValues.has(v)),
        });
      }

      // Sizes are always shown (every family has >1 size)
      activeAxes.push('size');
      // Numeric sort by the leading number, so 1.2 / 2.0 / 4.0 / 7.0 order
      // correctly instead of the wrong alphabetical "1.2, 10.0, 2.0" order.
      const sortedSizes = [...sizeValues].sort(
        (a, b) => sizeSortValue(a) - sizeSortValue(b),
      );
      optionGroups.push({
        key: 'size',
        label: 'Size',
        values: sortedSizes,
      });

      // Second pass: build variantMap
      const variantMap: Record<string, NozzleVariantLeaf> = {};

      for (const { product, layer, cutType } of bucket.rows) {
        const labels = sizeLabelsByProduct.get(product.id)!;
        for (const v of product.variants) {
          const size = labels.get(v.variantName)!;
          const optionValues: Record<string, string> = {};
          if (activeAxes.includes('layer') && layer) optionValues['layer'] = layer;
          if (activeAxes.includes('cutType')) optionValues['cutType'] = cutType;
          optionValues['size'] = size;

          const key = buildOptionKey(optionValues);

          variantMap[key] = {
            variantId: v.id,
            variantName: v.variantName,
            size,
            priceType: v.priceType,
            price: v.price ? String(v.price) : null,
            minOrderQty: v.minOrderQty,
          };
        }
      }

      const familyName = familyNameFor(
        bucket.brandName,
        bucket.productName,
        bucket.diameter,
      );

      families.push({
        familyKey: bucket.familyKey,
        familyName,
        brand: bucket.brandName,
        brandSlug: bucket.brandSlug,
        diameter: bucket.diameter,
        slug: bucket.slug,
        shortDescription: bucket.shortDescription,
        imagePath: bucket.imagePath,
        imageAlt: bucket.imageAlt,
        optionGroups,
        variantMap,
      });
    }

    // Sort families: branded first, then by name
    families.sort((a, b) => {
      if (a.brand && !b.brand) return -1;
      if (!a.brand && b.brand) return 1;
      return a.familyName.localeCompare(b.familyName);
    });

    return families;
  }
}
