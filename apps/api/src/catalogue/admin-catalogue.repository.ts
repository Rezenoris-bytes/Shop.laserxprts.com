import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { buildVariantSearchKey, slugify, type ComponentKind } from '@lei/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin catalogue writes.
 *
 * Kept separate from CatalogueRepository (public reads) because the two have
 * different access rules and different shapes — admin reads are unfiltered by
 * isActive, and every write here recomputes the derived fields the public side
 * depends on (variantAxes, price range, category counts).
 */
@Injectable()
export class AdminCatalogueRepository {
  constructor(private readonly prisma: PrismaService) { }

  // ── Categories ────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.client.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        isActive: true,
        sortOrder: true,
        productCount: true,
        isSeedData: true,
        parent: { select: { name: true } },
      },
    });
  }

  async findCategory(id: number) {
    return this.prisma.client.category.findUnique({ where: { id } });
  }

  async createCategory(data: {
    name: string;
    slug?: string;
    parentId?: number | null;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    metaTitle?: string;
    metaDescription?: string;
  }) {
    return this.prisma.raw.category.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        metaTitle: data.metaTitle ?? data.name,
        metaDescription: data.metaDescription ?? null,
      },
    });
  }

  async updateCategory(id: number, data: Prisma.CategoryUncheckedUpdateInput) {
    return this.prisma.raw.category.update({ where: { id }, data });
  }

  /**
   * Soft delete with slug renaming.
   *
   * Appending the id to the slug frees it for reuse — a plain unique index on
   * `slug` would otherwise block that name forever once soft-deleted.
   */
  async softDeleteCategory(id: number) {
    const category = await this.prisma.raw.category.findUniqueOrThrow({ where: { id } });
    return this.prisma.raw.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, slug: `${category.slug}--deleted-${id}` },
    });
  }

  // ── Part brands ───────────────────────────────────────────────────────

  async listPartBrands() {
    return this.prisma.client.partBrand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, isActive: true, isSeedData: true },
    });
  }

  async createPartBrand(data: {
    name: string;
    slug?: string;
    website?: string;
    isActive: boolean;
  }) {
    return this.prisma.raw.partBrand.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
        website: data.website ?? null,
        isActive: data.isActive,
      },
    });
  }

  async updatePartBrand(id: number, data: Prisma.PartBrandUncheckedUpdateInput) {
    return this.prisma.raw.partBrand.update({ where: { id }, data });
  }

  // ── Products ──────────────────────────────────────────────────────────

  async listProducts(params: { skip: number; take: number; q?: string; categoryId?: number }) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.q
        ? { OR: [{ name: { contains: params.q } }, { slug: { contains: params.q } }] }
        : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isFeatured: true,
          minPrice: true,
          maxPrice: true,
          isSeedData: true,
          category: { select: { name: true } },
          partBrand: { select: { name: true } },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return { items, total };
  }

  /** Just the category slug, for cache invalidation after a write. */
  async findProductCategorySlug(id: number): Promise<string | null> {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      select: { category: { select: { slug: true } } },
    });
    return product?.category?.slug ?? null;
  }

  async findProduct(id: number) {
    return this.prisma.client.product.findUnique({
      where: { id },
      include: {
        variants: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        attributeValues: { include: { attribute: true } },
        media: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
        compatibility: {
          include: { machineBrand: true, machineModel: true, machineVariant: true, variant: true },
        },
      },
    });
  }

  async createProduct(data: {
    categoryId: number;
    partBrandId?: number | null;
    name: string;
    slug?: string;
    productType: string;
    shortDescription?: string;
    description?: string;
    isFeatured: boolean;
    isActive: boolean;
    metaTitle?: string;
    metaDescription?: string;
  }) {
    return this.prisma.raw.product.create({
      data: {
        categoryId: data.categoryId,
        partBrandId: data.partBrandId ?? null,
        name: data.name,
        slug: data.slug || slugify(data.name),
        productType: data.productType as never,
        shortDescription: data.shortDescription ?? null,
        description: data.description ?? null,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        metaTitle: data.metaTitle ?? data.name,
        metaDescription: data.metaDescription ?? null,
        publishedAt: data.isActive ? new Date() : null,
      },
    });
  }

  async updateProduct(id: number, data: Prisma.ProductUncheckedUpdateInput) {
    return this.prisma.raw.product.update({ where: { id }, data });
  }

  /**
   * Undoes a soft delete, including the slug rename the delete applied, so the
   * product returns on its original URL.
   */
  async restoreProduct(id: number) {
    const product = await this.prisma.raw.product.findUniqueOrThrow({ where: { id } });
    const slug = product.slug.replace(new RegExp(`--deleted-${id}$`), '');
    const slugTaken = await this.prisma.raw.product.findFirst({
      where: { slug, id: { not: id } },
      select: { id: true },
    });
    return this.prisma.raw.product.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
        ...(slugTaken ? {} : { slug }),
      },
    });
  }

  async softDeleteProduct(id: number) {
    const product = await this.prisma.raw.product.findUniqueOrThrow({ where: { id } });
    return this.prisma.raw.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, slug: `${product.slug}--deleted-${id}` },
    });
  }

  // ── Variants ──────────────────────────────────────────────────────────

  async createVariant(data: {
    productId: number;
    sku: string;
    partNumber: string;
    mpn?: string;
    variantName: string;
    price?: number | null;
    priceType: string;
    unitOfMeasure: string;
    packSize: number;
    minOrderQty: number;
    leadTimeDays?: number | null;
    isDefault: boolean;
    position: number;
    isActive: boolean;
    attributes?: Record<string, string>;
  }) {
    const product = await this.prisma.raw.product.findUniqueOrThrow({
      where: { id: data.productId },
    });

    const variant = await this.prisma.raw.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku,
        partNumber: data.partNumber,
        mpn: data.mpn ?? null,
        variantName: data.variantName,
        searchKey: buildVariantSearchKey({
          partNumber: data.partNumber,
          sku: data.sku,
          variantName: data.variantName,
          productName: product.name,
        }),
        price: data.price ?? null,
        priceType: data.priceType as never,
        unitOfMeasure: data.unitOfMeasure as never,
        packSize: data.packSize,
        minOrderQty: data.minOrderQty,
        leadTimeDays: data.leadTimeDays ?? null,
        isDefault: data.isDefault,
        position: data.position,
        isActive: data.isActive,
      },
    });



    if (data.attributes) {
      await this.writeVariantAttributes(variant.id, data.attributes);
    }

    return variant;
  }

  async updateVariant(id: number, data: Prisma.ProductVariantUncheckedUpdateInput) {
    // Recompute the search key on any identity change, using the SAME shared
    // function the search endpoint queries against — otherwise the two drift.
    if (data.partNumber || data.sku || data.variantName) {
      const current = await this.prisma.raw.productVariant.findUniqueOrThrow({
        where: { id },
        include: { product: { select: { name: true } } },
      });
      data.searchKey = buildVariantSearchKey({
        partNumber: (data.partNumber as string) ?? current.partNumber,
        sku: (data.sku as string) ?? current.sku,
        variantName: (data.variantName as string) ?? current.variantName,
        productName: current.product.name,
      });
    }
    return this.prisma.raw.productVariant.update({ where: { id }, data });
  }

  /**
   * Soft delete with sku renaming — same convention as
   * softDeleteProduct/softDeleteCategory. The unique index on `sku` would
   * otherwise block that code being re-used once soft-deleted.
   *
   * `sku` is VarChar(64), and generated skus already run long — appending the
   * suffix without budgeting for it lets MySQL silently truncate the id back
   * off, so two variants under the same original sku could collide. Truncate
   * the base first instead.
   */
  async softDeleteVariant(id: number) {
    const variant = await this.prisma.raw.productVariant.findUniqueOrThrow({ where: { id } });
    const suffix = `--deleted-${id}`;
    const sku = `${variant.sku.slice(0, 64 - suffix.length)}${suffix}`;
    return this.prisma.raw.productVariant.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, sku },
    });
  }

  /** Hands isDefault to the next live variant, so a product never ends up with none. */
  async promoteNextDefaultVariant(productId: number): Promise<void> {
    const next = await this.prisma.raw.productVariant.findFirst({
      where: { productId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    if (next) {
      await this.prisma.raw.productVariant.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  async writeVariantAttributes(
    variantId: number,
    attributes: Record<string, string>,
  ): Promise<void> {
    for (const [slug, raw] of Object.entries(attributes)) {
      const attribute = await this.prisma.raw.attribute.findUnique({ where: { slug } });
      if (!attribute) continue;

      const numeric = Number(raw);
      const isNumeric =
        (attribute.dataType === 'DECIMAL' || attribute.dataType === 'INTEGER') &&
        Number.isFinite(numeric);

      const existing = await this.prisma.raw.attributeValue.findFirst({
        where: { variantId, attributeId: attribute.id },
      });

      const data = {
        attributeId: attribute.id,
        variantId,
        valueString: raw || null,
        valueDecimal: isNumeric ? numeric : null,
      };

      if (existing) {
        await this.prisma.raw.attributeValue.update({ where: { id: existing.id }, data });
      } else if (raw) {
        await this.prisma.raw.attributeValue.create({ data });
      }
    }
  }



  // ── Compatibility ─────────────────────────────────────────────────────

  async createCompatibility(data: {
    productId: number;
    variantId?: number | null;
    machineBrandId: number;
    machineModelId: number;
    machineVariantId?: number | null;
    notes?: string;
    isVerified: boolean;
    verifiedById?: number;
  }) {
    const duplicate = await this.prisma.raw.productCompatibility.findFirst({
      where: {
        productId: data.productId,
        variantId: data.variantId ?? null,
        machineModelId: data.machineModelId,
        machineVariantId: data.machineVariantId ?? null,
      },
    });
    if (duplicate) return duplicate;

    return this.prisma.raw.productCompatibility.create({
      data: {
        productId: data.productId,
        variantId: data.variantId ?? null,
        machineBrandId: data.machineBrandId,
        machineModelId: data.machineModelId,
        machineVariantId: data.machineVariantId ?? null,
        notes: data.notes ?? null,
        isVerified: data.isVerified,
        verifiedById: data.isVerified ? (data.verifiedById ?? null) : null,
        verifiedAt: data.isVerified ? new Date() : null,
      },
    });
  }

  async verifyCompatibility(id: number, verifiedById: number) {
    return this.prisma.raw.productCompatibility.update({
      where: { id },
      data: { isVerified: true, verifiedById, verifiedAt: new Date() },
    });
  }

  async deleteCompatibility(id: number) {
    return this.prisma.raw.productCompatibility.delete({ where: { id } });
  }

  // ── Machines ──────────────────────────────────────────────────────────

  /**
   * Brand list for admin, optionally scoped to one kind.
   *
   * Unscoped it returns all six kinds, which is right for an admin directory
   * but wrong for a picker labelled "machine" — pass the kind there, or the
   * user is offered chillers and servo makers as machines.
   */
  async listMachineBrands(kind?: ComponentKind) {
    return this.prisma.client.machineBrand.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: { models: { include: { variants: true }, orderBy: { name: 'asc' } } },
    });
  }

  async createMachineBrand(name: string, kind: ComponentKind = 'MACHINE') {
    return this.prisma.raw.machineBrand.create({ data: { name, kind, slug: slugify(name) } });
  }

  async createMachineModel(machineBrandId: number, name: string) {
    return this.prisma.raw.machineModel.create({
      data: { machineBrandId, name, slug: slugify(name) },
    });
  }

  async createMachineVariant(
    machineModelId: number,
    name: string,
    laserType?: string,
    powerWatts?: number,
  ) {
    return this.prisma.raw.machineVariant.create({
      data: { machineModelId, name, laserType: laserType ?? null, powerWatts: powerWatts ?? null },
    });
  }

  // ── Attributes ────────────────────────────────────────────────────────

  async listAttributes() {
    return this.prisma.client.attribute.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createAttribute(data: {
    name: string;
    slug?: string;
    dataType: string;
    defaultScope: string;
    unit?: string;
    isFilterable: boolean;
    sortOrder: number;
  }) {
    return this.prisma.raw.attribute.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
        dataType: data.dataType as never,
        defaultScope: data.defaultScope as never,
        unit: data.unit ?? null,
        isFilterable: data.isFilterable,
        sortOrder: data.sortOrder,
      },
    });
  }

  // ── Product media ──────────────────────────────────────────────────────

  async findProductMedia(productId: number) {
    return this.prisma.raw.productMedia.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { file: true },
    });
  }

  async findMedia(productId: number, mediaId: number) {
    return this.prisma.raw.productMedia.findFirst({
      where: { id: mediaId, productId },
      include: { file: true },
    });
  }

  /**
   * Appends an image to a product.
   *
   * The first image a product ever gets becomes its primary automatically —
   * a product with artwork but no primary renders the placeholder everywhere,
   * which looks like a bug rather than a setting nobody chose.
   */
  async attachMedia(productId: number, fileId: number, altText: string | null) {
    const existing = await this.prisma.raw.productMedia.findFirst({
      where: { productId, fileId },
    });
    if (existing) return existing;

    const [count, last] = await Promise.all([
      this.prisma.raw.productMedia.count({ where: { productId } }),
      this.prisma.raw.productMedia.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      }),
    ]);

    return this.prisma.raw.productMedia.create({
      data: {
        productId,
        fileId,
        type: 'IMAGE',
        altText,
        sortOrder: (last?.sortOrder ?? -10) + 10,
        isPrimary: count === 0,
      },
    });
  }

  /** Exactly one primary per product, enforced in a transaction. */
  async setPrimaryMedia(productId: number, mediaId: number): Promise<void> {
    await this.prisma.raw.$transaction([
      this.prisma.raw.productMedia.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      this.prisma.raw.productMedia.update({
        where: { id: mediaId },
        data: { isPrimary: true },
      }),
    ]);
  }

  /** Rewrites sortOrder from the given id sequence. */
  async reorderMedia(productId: number, mediaIds: number[]): Promise<void> {
    await this.prisma.raw.$transaction(
      mediaIds.map((id, index) =>
        this.prisma.raw.productMedia.updateMany({
          // Scoped by productId as well as id so a crafted payload cannot
          // reorder another product's gallery.
          where: { id, productId },
          data: { sortOrder: index * 10 },
        }),
      ),
    );
  }

  async updateMedia(
    productId: number,
    mediaId: number,
    data: { altText?: string | null; fileId?: number },
  ) {
    await this.prisma.raw.productMedia.updateMany({ where: { id: mediaId, productId }, data });
  }

  /**
   * Detaches an image, returning the file id so the caller can reap it if no
   * other product still uses it.
   *
   * If the primary is removed the next image takes over, so a product with
   * images always has one.
   */
  async detachMedia(productId: number, mediaId: number): Promise<number | null> {
    const row = await this.prisma.raw.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!row) return null;

    await this.prisma.raw.productMedia.delete({ where: { id: mediaId } });

    if (row.isPrimary) {
      const next = await this.prisma.raw.productMedia.findFirst({
        where: { productId },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      if (next) {
        await this.prisma.raw.productMedia.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    return row.fileId;
  }

  // ── Derived recompute (shared logic mirrors the importer) ───────────────

  /** Recomputes variantAxes, price range and hasStock for one product. */
  async recomputeProduct(productId: number): Promise<void> {
    const variants = await this.prisma.raw.productVariant.findMany({
      where: { productId, deletedAt: null, isActive: true },
      select: {
        price: true,
        attributeValues: { select: { attribute: { select: { slug: true } }, valueString: true } },
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



    await this.prisma.raw.product.update({
      where: { id: productId },
      data: {
        variantAxes,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
      },
    });
  }

  async recomputeCategoryCounts(): Promise<void> {
    const categories = await this.prisma.raw.category.findMany({
      select: { id: true, parentId: true },
    });
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
      const productCount = await this.prisma.raw.product.count({
        where: { categoryId: { in: descendantsOf(id) }, isActive: true, deletedAt: null },
      });
      await this.prisma.raw.category.update({ where: { id }, data: { productCount } });
    }
  }
}
