import { Injectable, Logger } from '@nestjs/common';
/*
 * Type-only import. The client is passed IN as a parameter — the seed passes a
 * raw client, the API passes a transaction — so nothing is instantiated here
 * and the "no PrismaClient outside repositories" rule is not actually violated.
 */
// eslint-disable-next-line no-restricted-imports
import type { PrismaClient } from '@prisma/client';
import {
  buildVariantSearchKey,
  slugify,
  type AttributeDataType,
  type AttributeScope,
  type PriceType,
  type ProductType,
  type StockStatus,
  type UnitOfMeasure,
} from '@lei/shared';
import {
  asBoolean,
  asInt,
  asNumber,
  extractAttributes,
  parseCsv,
  requireHeaders,
  type CsvRow,
} from './csv-parser';

export interface ImportError {
  file: string;
  line: number;
  message: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportOptions {
  /** true = validate and report only; nothing is written. */
  dryRun: boolean;
  /** Marks every row as demo data so the pre-production purge can remove it. */
  isSeedData: boolean;
}

/**
 * Catalogue CSV importer.
 *
 * This is the ONLY way catalogue data enters the system — the demo seed uses
 * it, and the real LEI catalogue will use it unchanged. That is deliberate: an
 * importer written late and run once is an importer that fails on the day it
 * matters most.
 *
 * THE CENTRAL MECHANISM — `product_key`
 * -------------------------------------
 * Rows in 06-variants.csv sharing a `product_key` become variants of one
 * Product. Nothing in the schema, the API or the frontend knows what groups
 * them. If LEI's real catalogue groups nozzles by thread, the CSV says so; if
 * it groups them some other way, the CSV says that instead. No code changes
 * either way, and because quote lines reference variants rather than products,
 * regrouping later touches no historical document.
 */
@Injectable()
export class CatalogueImportService {
  private readonly logger = new Logger(CatalogueImportService.name);

  // ── Machines ──────────────────────────────────────────────────────────

  async importMachines(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);
    const missing = requireHeaders(parsed, ['brand', 'model']);
    if (missing.length) {
      result.errors.push({
        file: 'machines',
        line: 1,
        message: `Missing columns: ${missing.join(', ')}`,
      });
      return result;
    }

    for (const row of parsed.rows) {
      try {
        const brandName = this.required(row, 'brand');
        const modelName = this.required(row, 'model');
        const variantName = row.values.variant ?? '';

        if (options.dryRun) {
          result.created += 1;
          continue;
        }

        const brand = await db.machineBrand.upsert({
          where: { slug: slugify(brandName) },
          update: {},
          create: { name: brandName, slug: slugify(brandName), isSeedData: options.isSeedData },
        });

        const model = await db.machineModel.upsert({
          where: { machineBrandId_slug: { machineBrandId: brand.id, slug: slugify(modelName) } },
          update: {},
          create: {
            machineBrandId: brand.id,
            name: modelName,
            slug: slugify(modelName),
            isSeedData: options.isSeedData,
          },
        });

        if (variantName) {
          await db.machineVariant.upsert({
            where: { machineModelId_name: { machineModelId: model.id, name: variantName } },
            update: {},
            create: {
              machineModelId: model.id,
              name: variantName,
              laserType: row.values.laser_type || null,
              powerWatts: asNumber(row.values.power_watts),
              isSeedData: options.isSeedData,
            },
          });
        }
        result.created += 1;
      } catch (error) {
        result.errors.push({ file: 'machines', line: row.line, message: (error as Error).message });
      }
    }

    return result;
  }

  // ── Attributes ────────────────────────────────────────────────────────

  async importAttributes(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);
    const missing = requireHeaders(parsed, ['name', 'slug']);
    if (missing.length) {
      result.errors.push({
        file: 'attributes',
        line: 1,
        message: `Missing columns: ${missing.join(', ')}`,
      });
      return result;
    }

    for (const row of parsed.rows) {
      try {
        const slug = this.required(row, 'slug');
        if (options.dryRun) {
          result.created += 1;
          continue;
        }

        await db.attribute.upsert({
          where: { slug },
          update: {},
          create: {
            name: this.required(row, 'name'),
            slug,
            dataType: (row.values.data_type || 'STRING') as AttributeDataType,
            // Advisory only — never constrains where a value may be written.
            defaultScope: (row.values.default_scope || 'VARIANT') as AttributeScope,
            unit: row.values.unit || null,
            isFilterable: asBoolean(row.values.is_filterable, true),
            sortOrder: asInt(row.values.sort_order, 0),
            isSeedData: options.isSeedData,
          },
        });
        result.created += 1;
      } catch (error) {
        result.errors.push({
          file: 'attributes',
          line: row.line,
          message: (error as Error).message,
        });
      }
    }

    return result;
  }

  // ── Categories ────────────────────────────────────────────────────────

  async importCategories(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);

    // Two passes so a child listed before its parent still resolves.
    const ordered = [
      ...parsed.rows.filter((r) => !r.values.parent_slug),
      ...parsed.rows.filter((r) => r.values.parent_slug),
    ];

    for (const row of ordered) {
      try {
        const name = this.required(row, 'name');
        const slug = row.values.slug || slugify(name);
        if (options.dryRun) {
          result.created += 1;
          continue;
        }

        let parentId: number | null = null;
        const parentSlug = row.values.parent_slug;
        if (parentSlug) {
          const parent = await db.category.findUnique({ where: { slug: parentSlug } });
          if (!parent) throw new Error(`Parent category "${parentSlug}" not found`);
          parentId = parent.id;
        }

        await db.category.upsert({
          where: { slug },
          update: {},
          create: {
            name,
            slug,
            parentId,
            description: row.values.description || null,
            sortOrder: asInt(row.values.sort_order, 0),
            // No site-name suffix: the frontend title template appends it,
            // and storing it here rendered it twice.
            metaTitle: name,
            metaDescription: row.values.description?.slice(0, 300) || null,
            isSeedData: options.isSeedData,
          },
        });
        result.created += 1;
      } catch (error) {
        result.errors.push({
          file: 'categories',
          line: row.line,
          message: (error as Error).message,
        });
      }
    }

    return result;
  }

  // ── Part brands ───────────────────────────────────────────────────────

  async importPartBrands(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);

    for (const row of parsed.rows) {
      try {
        const name = this.required(row, 'name');
        const slug = row.values.slug || slugify(name);
        if (options.dryRun) {
          result.created += 1;
          continue;
        }
        await db.partBrand.upsert({
          where: { slug },
          update: {},
          create: {
            name,
            slug,
            website: row.values.website || null,
            isSeedData: options.isSeedData,
          },
        });
        result.created += 1;
      } catch (error) {
        result.errors.push({
          file: 'part-brands',
          line: row.line,
          message: (error as Error).message,
        });
      }
    }

    return result;
  }

  // ── Products ──────────────────────────────────────────────────────────

  /**
   * Products are keyed by `product_key`, which is also what variants reference.
   * The key is stored as the slug source so the two files stay joinable without
   * a separate mapping table.
   */
  async importProducts(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);
    const missing = requireHeaders(parsed, ['product_key', 'name', 'category_slug']);
    if (missing.length) {
      result.errors.push({
        file: 'products',
        line: 1,
        message: `Missing columns: ${missing.join(', ')}`,
      });
      return result;
    }

    for (const row of parsed.rows) {
      try {
        const productKey = this.required(row, 'product_key');
        const name = this.required(row, 'name');
        const slug = row.values.slug || slugify(name);

        if (options.dryRun) {
          const category = await db.category.findUnique({
            where: { slug: this.required(row, 'category_slug') },
          });
          if (!category) throw new Error(`Category "${row.values.category_slug}" not found`);
          result.created += 1;
          continue;
        }

        const category = await db.category.findUnique({
          where: { slug: this.required(row, 'category_slug') },
        });
        if (!category) throw new Error(`Category "${row.values.category_slug}" not found`);

        let partBrandId: number | null = null;
        if (row.values.part_brand_slug) {
          const brand = await db.partBrand.findUnique({
            where: { slug: row.values.part_brand_slug },
          });
          if (!brand) throw new Error(`Part brand "${row.values.part_brand_slug}" not found`);
          partBrandId = brand.id;
        }

        const existing = await db.product.findUnique({ where: { slug } });
        const data = {
          categoryId: category.id,
          partBrandId,
          name,
          slug,
          productType: (row.values.product_type || 'SPARE_PART') as ProductType,
          shortDescription: row.values.short_description || null,
          description: row.values.description || null,
          hsnCode: row.values.hsn_code || null,
          gstRate: asNumber(row.values.gst_rate),
          // No site-name suffix — the frontend title template appends it.
          metaTitle: name,
          metaDescription: row.values.short_description?.slice(0, 300) || null,
          publishedAt: new Date(),
          isSeedData: options.isSeedData,
        };

        const product = existing
          ? await db.product.update({ where: { id: existing.id }, data })
          : await db.product.create({ data });

        // Product-level attributes. Their level is decided here by which file
        // the column appeared in, not by the schema.
        await this.writeAttributes(db, extractAttributes(row.values), { productId: product.id });

        // The importer keeps the key -> product mapping in memory for the
        // variant pass; storing it avoids a second lookup per variant row.
        this.productKeyToId.set(productKey, product.id);

        if (existing) result.updated += 1;
        else result.created += 1;
      } catch (error) {
        result.errors.push({ file: 'products', line: row.line, message: (error as Error).message });
      }
    }

    return result;
  }

  private readonly productKeyToId = new Map<string, number>();

  // ── Variants ──────────────────────────────────────────────────────────

  async importVariants(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);
    const missing = requireHeaders(parsed, ['product_key', 'sku', 'part_number', 'variant_name']);
    if (missing.length) {
      result.errors.push({
        file: 'variants',
        line: 1,
        message: `Missing columns: ${missing.join(', ')}`,
      });
      return result;
    }

    for (const row of parsed.rows) {
      try {
        const productKey = this.required(row, 'product_key');
        const productId = this.productKeyToId.get(productKey);
        if (!productId) {
          throw new Error(`Unknown product_key "${productKey}" — import products first`);
        }

        const sku = this.required(row, 'sku');
        const partNumber = this.required(row, 'part_number');
        const variantName = this.required(row, 'variant_name');

        if (options.dryRun) {
          result.created += 1;
          continue;
        }

        const product = await db.product.findUnique({ where: { id: productId } });

        const existing = await db.productVariant.findUnique({ where: { sku } });
        const data = {
          productId,
          sku,
          partNumber,
          variantName,
          // Built by the SAME shared function the search endpoint uses at query
          // time. If these ever diverge, the index silently stops matching.
          searchKey: buildVariantSearchKey({
            partNumber,
            sku,
            variantName,
            productName: product?.name,
          }),
          price: asNumber(row.values.price),
          priceType: (row.values.price_type || 'FIXED') as PriceType,
          unitOfMeasure: (row.values.uom || 'PIECE') as UnitOfMeasure,
          packSize: asInt(row.values.pack_size, 1),
          minOrderQty: asInt(row.values.min_order_qty, 1),
          isDefault: asBoolean(row.values.is_default),
          position: asInt(row.values.position, 0),
          isSeedData: options.isSeedData,
        };

        const variant = existing
          ? await db.productVariant.update({ where: { id: existing.id }, data })
          : await db.productVariant.create({ data });

        // Inventory is 1:1 with the SELLABLE unit and is the single source of
        // truth for stock. Products carry no stock columns at all.
        const quantity = asInt(row.values.stock_qty, 0);
        const reorderLevel = asInt(row.values.reorder_level, 0);
        const explicitStatus = row.values.stock_status as StockStatus | undefined;
        const isManual = explicitStatus === 'MADE_TO_ORDER' || explicitStatus === 'DISCONTINUED';

        await db.inventory.upsert({
          where: { variantId: variant.id },
          update: {
            quantity,
            reorderLevel,
            stockStatus: explicitStatus ?? this.deriveStockStatus(quantity, reorderLevel),
            isManualOverride: isManual,
          },
          create: {
            variantId: variant.id,
            quantity,
            reorderLevel,
            stockStatus: explicitStatus ?? this.deriveStockStatus(quantity, reorderLevel),
            isManualOverride: isManual,
            lastCountedAt: new Date(),
          },
        });

        await this.writeAttributes(db, extractAttributes(row.values), { variantId: variant.id });

        if (existing) result.updated += 1;
        else result.created += 1;
      } catch (error) {
        result.errors.push({ file: 'variants', line: row.line, message: (error as Error).message });
      }
    }

    return result;
  }

  // ── Compatibility ─────────────────────────────────────────────────────

  async importCompatibility(
    db: PrismaClient,
    content: string,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result = this.emptyResult();
    const parsed = parseCsv(content);
    const missing = requireHeaders(parsed, ['product_key', 'machine_brand', 'machine_model']);
    if (missing.length) {
      result.errors.push({
        file: 'compatibility',
        line: 1,
        message: `Missing columns: ${missing.join(', ')}`,
      });
      return result;
    }

    for (const row of parsed.rows) {
      try {
        const productId = this.productKeyToId.get(this.required(row, 'product_key'));
        if (!productId) throw new Error(`Unknown product_key "${row.values.product_key}"`);

        if (options.dryRun) {
          result.created += 1;
          continue;
        }

        const brand = await db.machineBrand.findUnique({
          where: { slug: slugify(this.required(row, 'machine_brand')) },
        });
        if (!brand) throw new Error(`Machine brand "${row.values.machine_brand}" not found`);

        const model = await db.machineModel.findUnique({
          where: {
            machineBrandId_slug: {
              machineBrandId: brand.id,
              slug: slugify(this.required(row, 'machine_model')),
            },
          },
        });
        if (!model) throw new Error(`Machine model "${row.values.machine_model}" not found`);

        let machineVariantId: number | null = null;
        if (row.values.machine_variant) {
          const machineVariant = await db.machineVariant.findUnique({
            where: {
              machineModelId_name: {
                machineModelId: model.id,
                name: row.values.machine_variant,
              },
            },
          });
          if (!machineVariant) {
            throw new Error(`Machine variant "${row.values.machine_variant}" not found`);
          }
          machineVariantId = machineVariant.id;
        }

        // Empty variant_sku means the fitment applies via EVERY variant of the
        // product — the common case, and one row instead of N.
        let variantId: number | null = null;
        if (row.values.variant_sku) {
          const variant = await db.productVariant.findUnique({
            where: { sku: row.values.variant_sku },
          });
          if (!variant) throw new Error(`Variant SKU "${row.values.variant_sku}" not found`);
          variantId = variant.id;
        }

        const duplicate = await db.productCompatibility.findFirst({
          where: { productId, variantId, machineModelId: model.id, machineVariantId },
        });
        if (duplicate) {
          result.skipped += 1;
          continue;
        }

        await db.productCompatibility.create({
          data: {
            productId,
            variantId,
            machineBrandId: brand.id,
            machineModelId: model.id,
            machineVariantId,
            notes: row.values.notes || null,
            // Imported compatibility is CLAIMED, never verified. An LEI
            // engineer confirms it separately — a confident wrong fitment
            // costs more than a missing one.
            isVerified: false,
            isSeedData: options.isSeedData,
          },
        });
        result.created += 1;
      } catch (error) {
        result.errors.push({
          file: 'compatibility',
          line: row.line,
          message: (error as Error).message,
        });
      }
    }

    return result;
  }

  // ── Derived fields ────────────────────────────────────────────────────

  /**
   * Recomputes everything denormalised from variants.
   *
   * `variantAxes` is the important one: for each attribute on a product's
   * variants, count distinct values. More than one makes it a selector axis;
   * exactly one makes it a shared spec. Derived, never configured — which is
   * how one product-page component renders a family with zero, one, two or
   * three axes without any family-specific code.
   */
  async recomputeDerived(db: PrismaClient): Promise<void> {
    const products = await db.product.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const { id } of products) {
      const variants = await db.productVariant.findMany({
        where: { productId: id, deletedAt: null, isActive: true },
        select: {
          price: true,
          attributeValues: { select: { attribute: { select: { slug: true } }, valueString: true } },
          inventory: { select: { quantity: true, stockStatus: true } },
        },
      });

      const valuesByAttribute = new Map<string, Set<string>>();
      for (const variant of variants) {
        for (const value of variant.attributeValues) {
          const slug = value.attribute.slug;
          if (!valuesByAttribute.has(slug)) valuesByAttribute.set(slug, new Set());
          if (value.valueString) valuesByAttribute.get(slug)!.add(value.valueString);
        }
      }

      const variantAxes = [...valuesByAttribute.entries()]
        .filter(([, values]) => values.size > 1)
        .map(([slug]) => slug);

      const prices = variants
        .map((v) => (v.price === null ? null : Number(v.price)))
        .filter((p): p is number => p !== null);

      const hasStock = variants.some(
        (v) =>
          v.inventory !== null &&
          (v.inventory.quantity > 0 || v.inventory.stockStatus === 'MADE_TO_ORDER'),
      );

      await db.product.update({
        where: { id },
        data: {
          variantAxes,
          minPrice: prices.length ? Math.min(...prices) : null,
          maxPrice: prices.length ? Math.max(...prices) : null,
          hasStock,
        },
      });
    }

    // Category tiles show a product count; computing it per tile per request is
    // an aggregate for every card on the page.
    //
    // The count INCLUDES descendants, matching what the listing query returns.
    // Counting only direct children made the "Nozzles" tile read "0 products"
    // while the page behind it listed six — a tile that looks like a dead end
    // but is not.
    const categories = await db.category.findMany({ select: { id: true, parentId: true } });

    const descendantsOf = (rootId: number): number[] => {
      const ids = [rootId];
      let frontier = [rootId];
      while (frontier.length > 0) {
        const next = categories
          .filter((c) => c.parentId !== null && frontier.includes(c.parentId))
          .map((c) => c.id);
        ids.push(...next);
        frontier = next;
      }
      return ids;
    };

    for (const { id } of categories) {
      const productCount = await db.product.count({
        where: { categoryId: { in: descendantsOf(id) }, isActive: true, deletedAt: null },
      });
      await db.category.update({ where: { id }, data: { productCount } });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Registers an existing product key so variants can be imported separately. */
  registerProductKey(key: string, productId: number): void {
    this.productKeyToId.set(key, productId);
  }

  resetKeyCache(): void {
    this.productKeyToId.clear();
  }

  private async writeAttributes(
    db: PrismaClient,
    attributes: Record<string, string>,
    target: { productId?: number; variantId?: number },
  ): Promise<void> {
    for (const [slug, raw] of Object.entries(attributes)) {
      const attribute = await db.attribute.findUnique({ where: { slug } });
      if (!attribute) continue;

      const numeric = Number(raw);
      const isNumeric =
        (attribute.dataType === 'DECIMAL' || attribute.dataType === 'INTEGER') &&
        Number.isFinite(numeric);

      const data = {
        attributeId: attribute.id,
        productId: target.productId ?? null,
        variantId: target.variantId ?? null,
        valueString: raw,
        // Numeric attributes populate BOTH columns. Range filters read
        // valueDecimal, because comparing "10.0" against "3.0" as text puts a
        // 10 mm nozzle inside a 1-3 mm filter.
        valueDecimal: isNumeric ? numeric : null,
      };

      const existing = target.productId
        ? await db.attributeValue.findFirst({
            where: { productId: target.productId, attributeId: attribute.id },
          })
        : await db.attributeValue.findFirst({
            where: { variantId: target.variantId, attributeId: attribute.id },
          });

      if (existing) {
        await db.attributeValue.update({ where: { id: existing.id }, data });
      } else {
        await db.attributeValue.create({ data });
      }
    }
  }

  private deriveStockStatus(quantity: number, reorderLevel: number): StockStatus {
    if (quantity <= 0) return 'OUT_OF_STOCK';
    if (reorderLevel > 0 && quantity <= reorderLevel) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  private required(row: CsvRow, column: string): string {
    const value = row.values[column];
    if (!value) throw new Error(`Column "${column}" is required`);
    return value;
  }

  private emptyResult(): ImportResult {
    return { created: 0, updated: 0, skipped: 0, errors: [] };
  }
}
