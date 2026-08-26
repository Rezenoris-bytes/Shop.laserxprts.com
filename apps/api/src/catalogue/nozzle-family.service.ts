import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrored in the web app's lib/nozzle-family.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface NozzleVariantLeaf {
  variantId: number;
  sku: string;
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

/**
 * Derive the orifice size label from a variant's variantName.
 * Handles forms like: "1.2 mm", "0.8E", "D1.2", "1.4", "2.0 H15"
 * Returns e.g. "1.2", "0.8", or the original if no numeric found.
 */
function extractSize(variantName: string): string {
  // Strip leading D/d prefix (Amada D1.2 style)
  const stripped = variantName.replace(/^D/i, '');
  // Extract the first decimal/integer number
  const m = stripped.match(/(\d+(?:\.\d+)?)/);
  return m && m[1] ? m[1] : variantName.trim();
}

/**
 * Compute the canonical family key for a product, used to group products
 * into a single family card.
 *
 * Formula: {brandSlug}-{diameter|''}-cutting-nozzle
 * Works for every brand without any brand-specific logic.
 */
function familyKeyFor(brandSlug: string | null, productName: string): string {
  const diam = extractDiameter(productName);
  const parts: string[] = [];
  if (brandSlug) parts.push(brandSlug);
  if (diam) parts.push(diam.toLowerCase());
  parts.push('cutting-nozzle');
  return parts.join('-');
}

/**
 * Compute a human-readable family name from brand + diameter, stripping
 * "Single/Double Layer" and "Fast/Standard" — those become option groups.
 *
 * Example: "RayTools D32 Cutting Nozzle"
 */
function familyNameFor(
  brandName: string | null,
  productName: string,
  diameter: string | null,
): string {
  // Remove layer and cut-type qualifiers from the product name
  let base = productName
    .replace(/\b(single|double)\s+layer\b/gi, '')
    .replace(/\bfast\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If brand name is prepended in the product name, remove it to avoid repetition
  if (brandName) {
    const brandRe = new RegExp(`^${brandName}\\s*`, 'i');
    base = base.replace(brandRe, '').trim();
  }

  // Remove diameter if already embedded — we'll re-add it cleanly
  if (diameter) {
    base = base.replace(new RegExp(`\\b${diameter}\\b`, 'i'), '').trim();
  }

  // Collapse repeated whitespace
  base = base.replace(/\s{2,}/g, ' ').trim();

  const parts: string[] = [];
  if (brandName) parts.push(brandName);
  if (diameter) parts.push(diameter);
  parts.push(base || 'Cutting Nozzle');

  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
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
            sku: true,
            variantName: true,
            price: true,
            priceType: true,
            minOrderQty: true,
          },
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
      const fKey = familyKeyFor(brandSlug, product.name);

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
      // Collect all distinct values for each potential axis
      const layerValues = new Set<string>();
      const cutTypeValues = new Set<string>();
      const sizeValues = new Set<string>();

      // First pass: collect all distinct values
      for (const { product, layer, cutType } of bucket.rows) {
        if (layer) layerValues.add(layer);
        cutTypeValues.add(cutType);
        for (const v of product.variants) {
          sizeValues.add(extractSize(v.variantName));
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
      // Sort numerically
      const sortedSizes = [...sizeValues].sort(
        (a, b) => parseFloat(a) - parseFloat(b),
      );
      optionGroups.push({
        key: 'size',
        label: 'Size',
        values: sortedSizes,
      });

      // Second pass: build variantMap
      const variantMap: Record<string, NozzleVariantLeaf> = {};

      for (const { product, layer, cutType } of bucket.rows) {
        for (const v of product.variants) {
          const size = extractSize(v.variantName);
          const optionValues: Record<string, string> = {};
          if (activeAxes.includes('layer') && layer) optionValues['layer'] = layer;
          if (activeAxes.includes('cutType')) optionValues['cutType'] = cutType;
          optionValues['size'] = size;

          const key = buildOptionKey(optionValues);

          variantMap[key] = {
            variantId: v.id,
            sku: v.sku,
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
