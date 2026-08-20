import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { normalizeSearchKey, type ProductListQuery } from '@lei/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Only the fields a product card needs — never the description blob. */
const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  minPrice: true,
  maxPrice: true,
  hasStock: true,
  variantAxes: true,
  isSeedData: true,
  category: { select: { name: true, slug: true } },
  partBrand: { select: { name: true, slug: true } },
  media: {
    where: { isPrimary: true },
    take: 1,
    select: { altText: true, file: { select: { storedName: true, path: true } } },
  },
  /// Product-level specs only. The row layout shows a short spec table per
  /// card, and variant-level values would differ within one row and read as
  /// contradictions. Capped because the table is truncated for display anyway.
  attributeValues: {
    where: { attribute: { showInSpecs: true } },
    take: 8,
    select: {
      valueString: true,
      attribute: { select: { name: true, slug: true, unit: true, sortOrder: true } },
    },
  },
  /// The variant a quote request from a card is raised against. Cards cannot
  /// show a selector, so the default is the only sensible target — which is
  /// why the modal says so plainly whenever a product has more than one.
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { id: true, minOrderQty: true },
  },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;

/**
 * Everything a catalogue row renders.
 *
 * Products have no page of their own — a row IS the product — so the listing
 * carries the full gallery, the whole specification table and the sellable
 * variants. Kept separate from CARD_SELECT because the homepage, search and
 * related-product strips still want the cheap shape; loading galleries there
 * would pay for images nobody scrolls to.
 */
const LISTING_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  minPrice: true,
  maxPrice: true,
  hasStock: true,
  variantAxes: true,
  isSeedData: true,
  category: { select: { name: true, slug: true } },
  partBrand: { select: { name: true, slug: true } },
  media: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      altText: true,
      isPrimary: true,
      file: { select: { storedName: true, path: true, width: true, height: true } },
    },
  },
  attributeValues: {
    where: { attribute: { showInSpecs: true } },
    select: {
      valueString: true,
      attribute: { select: { name: true, slug: true, unit: true, sortOrder: true } },
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      partNumber: true,
      mpn: true,
      variantName: true,
      price: true,
      priceType: true,
      mrp: true,
      unitOfMeasure: true,
      packSize: true,
      minOrderQty: true,
      leadTimeDays: true,
      isDefault: true,
      inventory: { select: { quantity: true, stockStatus: true } },
      attributeValues: {
        select: {
          valueString: true,
          attribute: { select: { name: true, slug: true, unit: true, sortOrder: true } },
        },
      },
    },
  },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;

export interface AttributeFilter {
  slug: string;
  /** Exact text match. */
  value?: string;
  /** Inclusive numeric range, from `slug:1.0..3.0`. */
  min?: number;
  max?: number;
}

@Injectable()
export class CatalogueRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────────

  async findCategoryTree() {
    return this.prisma.client.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        description: true,
        productCount: true,
      },
    });
  }

  /**
   * Names for the sidebar's expanded category panel.
   *
   * One flat query grouped in memory rather than a per-category query: the
   * tree is thirty-odd categories, and thirty round trips to show five links
   * each is the classic N+1. The tree endpoint is ISR-cached for an hour, so
   * this runs a handful of times a day.
   */
  async findCategoryProductPreviews() {
    return this.prisma.client.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        name: true,
        slug: true,
        categoryId: true,
        // Doubles as the source of the category tile's thumbnail: a category
        // has no artwork of its own, and the first product in it is a truer
        // picture of the category than any stock image would be.
        media: {
          where: { isPrimary: true },
          take: 1,
          select: { altText: true, file: { select: { storedName: true, path: true } } },
        },
      },
    });
  }

  async findCategoryBySlug(slug: string) {
    return this.prisma.client.category.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        productCount: true,
        metaTitle: true,
        metaDescription: true,
        seoIndexable: true,
        parent: { select: { name: true, slug: true } },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, slug: true, productCount: true },
        },
      },
    });
  }

  /** Every descendant id, so a parent category lists its children's products. */
  async categoryIdsIncludingDescendants(rootId: number): Promise<number[]> {
    const all = await this.prisma.client.category.findMany({
      select: { id: true, parentId: true },
    });
    const ids = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const next = all.filter((c) => c.parentId !== null && frontier.includes(c.parentId));
      frontier = next.map((c) => c.id);
      ids.push(...frontier);
    }
    return ids;
  }

  // ── Product listing ───────────────────────────────────────────────────

  /**
   * Product listing with filters.
   *
   * Attribute filters resolve to variant/product ids first and are then applied
   * as an `id IN (...)` on products. Doing it this way keeps the main query on
   * indexed columns instead of joining the EAV table N times for N filters.
   */
  async listProducts(query: ProductListQuery, attributeFilters: AttributeFilter[]) {
    // deletedAt as well as isActive: soft delete clears isActive today, so this
    // is belt and braces — but a product restored to active while still
    // deleted would otherwise reappear in the catalogue.
    const where: Prisma.ProductWhereInput = { isActive: true, deletedAt: null };

    if (query.category) {
      const category = await this.prisma.client.category.findFirst({
        where: { slug: query.category },
        select: { id: true },
      });
      if (!category) return { items: [], total: 0 };
      where.categoryId = { in: await this.categoryIdsIncludingDescendants(category.id) };
    }

    if (query.brand) {
      where.partBrand = { slug: query.brand };
    }

    if (query.inStock) {
      where.hasStock = true;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.minPrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    // Compatibility: "parts that fit this machine". Matches rows attached at
    // product level (variantId NULL) and at variant level alike.
    if (query.machineModel) {
      where.compatibility = { some: { machineModelId: query.machineModel } };
    } else if (query.machineBrand) {
      where.compatibility = { some: { machineBrandId: query.machineBrand } };
    }

    if (attributeFilters.length > 0) {
      const matchingIds = await this.productIdsMatchingAttributes(attributeFilters);
      if (matchingIds.length === 0) return { items: [], total: 0 };
      where.id = { in: matchingIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        select: LISTING_SELECT,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Resolves attribute filters to product ids.
   *
   * Numeric comparisons use `valueDecimal`, never `valueString`. Comparing
   * "10.0" against "3.0" as text places a 10 mm nozzle inside a 1-3 mm filter —
   * a wrong-results bug that is very hard to notice.
   */
  private async productIdsMatchingAttributes(filters: AttributeFilter[]): Promise<number[]> {
    let intersection: Set<number> | null = null;

    for (const filter of filters) {
      const attribute = await this.prisma.client.attribute.findUnique({
        where: { slug: filter.slug },
        select: { id: true },
      });
      if (!attribute) return [];

      const valueWhere: Prisma.AttributeValueWhereInput = { attributeId: attribute.id };
      if (filter.min !== undefined || filter.max !== undefined) {
        valueWhere.valueDecimal = {
          ...(filter.min !== undefined ? { gte: filter.min } : {}),
          ...(filter.max !== undefined ? { lte: filter.max } : {}),
        };
      } else if (filter.value !== undefined) {
        valueWhere.valueString = filter.value;
      }

      const matches = await this.prisma.client.attributeValue.findMany({
        where: valueWhere,
        select: { productId: true, variant: { select: { productId: true } } },
      });

      // A value sits on either the product or one of its variants — both
      // resolve to the same product for filtering purposes.
      const ids = new Set<number>();
      for (const match of matches) {
        const productId = match.productId ?? match.variant?.productId;
        if (productId) ids.add(productId);
      }

      if (intersection === null) {
        intersection = ids;
      } else {
        const previous: Set<number> = intersection;
        intersection = new Set([...previous].filter((id) => ids.has(id)));
      }
      if (intersection.size === 0) return [];
    }

    return intersection ? [...intersection] : [];
  }

  private orderBy(sort: ProductListQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'name_asc':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'name_desc':
        return [{ name: 'desc' }, { id: 'asc' }];
      case 'price_asc':
        return [{ minPrice: 'asc' }, { id: 'asc' }];
      case 'price_desc':
        return [{ maxPrice: 'desc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      default:
        // Featured first, then in-stock, then name. Always with an indexed
        // tiebreaker so pagination is stable and keyset-ready.
        return [{ isFeatured: 'desc' }, { hasStock: 'desc' }, { name: 'asc' }, { id: 'asc' }];
    }
  }

  // ── Product detail ────────────────────────────────────────────────────

  async findProductBySlug(slug: string) {
    return this.prisma.client.product.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        productType: true,
        hsnCode: true,
        gstRate: true,
        minPrice: true,
        maxPrice: true,
        hasStock: true,
        variantAxes: true,
        isSeedData: true,
        metaTitle: true,
        metaDescription: true,
        ogTitle: true,
        ogDescription: true,
        seoIndexable: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: { select: { name: true, slug: true } },
          },
        },
        partBrand: { select: { id: true, name: true, slug: true } },
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            type: true,
            altText: true,
            isPrimary: true,
            file: { select: { storedName: true, path: true, width: true, height: true } },
          },
        },
        attributeValues: {
          select: {
            valueString: true,
            valueDecimal: true,
            attribute: {
              select: { name: true, slug: true, unit: true, showInSpecs: true, sortOrder: true },
            },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            sku: true,
            partNumber: true,
            mpn: true,
            variantName: true,
            price: true,
            priceType: true,
            mrp: true,
            unitOfMeasure: true,
            packSize: true,
            minOrderQty: true,
            leadTimeDays: true,
            isDefault: true,
            inventory: { select: { quantity: true, stockStatus: true } },
            attributeValues: {
              select: {
                valueString: true,
                valueDecimal: true,
                attribute: { select: { name: true, slug: true, unit: true, sortOrder: true } },
              },
            },
          },
        },
        compatibility: {
          orderBy: [{ machineBrandId: 'asc' }, { machineModelId: 'asc' }],
          select: {
            id: true,
            variantId: true,
            notes: true,
            isVerified: true,
            isSeedData: true,
            machineBrand: { select: { id: true, name: true, slug: true } },
            machineModel: { select: { id: true, name: true, slug: true } },
            machineVariant: { select: { id: true, name: true, powerWatts: true } },
          },
        },
      },
    });
  }

  /** Products fitting the same machines — the highest-value internal links. */
  async findRelatedByCompatibility(productId: number, limit = 8) {
    const models = await this.prisma.client.productCompatibility.findMany({
      where: { productId },
      select: { machineModelId: true },
    });
    if (models.length === 0) return [];

    return this.prisma.client.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        id: { not: productId },
        compatibility: { some: { machineModelId: { in: models.map((m) => m.machineModelId) } } },
      },
      select: CARD_SELECT,
      take: limit,
      orderBy: [{ isFeatured: 'desc' }, { hasStock: 'desc' }, { id: 'asc' }],
    });
  }

  // ── Basket rehydration ────────────────────────────────────────────────

  /**
   * Resolves variant ids to live data.
   *
   * The browser stores ids and quantities only, never prices — so a tampered
   * localStorage cannot influence what a quote request contains. Deactivated or
   * deleted variants simply do not come back, and the UI reports them as no
   * longer available rather than failing the whole basket.
   */
  async resolveVariants(ids: number[]) {
    if (ids.length === 0) return [];
    return this.prisma.client.productVariant.findMany({
      where: { id: { in: ids }, isActive: true, product: { isActive: true, deletedAt: null } },
      select: {
        id: true,
        sku: true,
        partNumber: true,
        variantName: true,
        price: true,
        priceType: true,
        unitOfMeasure: true,
        packSize: true,
        minOrderQty: true,
        inventory: { select: { stockStatus: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            // The basket links back to the product's row, which lives on its
            // category listing — without the category the anchor cannot be
            // built.
            category: { select: { name: true, slug: true } },
            media: {
              where: { isPrimary: true },
              take: 1,
              select: { altText: true, file: { select: { storedName: true, path: true } } },
            },
          },
        },
      },
    });
  }

  // ── Filter facets ─────────────────────────────────────────────────────

  /** Filterable attributes with their distinct values, for the filter sidebar. */
  async facetsForCategory(categorySlug?: string) {
    const attributes = await this.prisma.client.attribute.findMany({
      where: { isFilterable: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true, unit: true, dataType: true },
    });

    let productIds: number[] | undefined;
    if (categorySlug) {
      const category = await this.prisma.client.category.findFirst({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (category) {
        const categoryIds = await this.categoryIdsIncludingDescendants(category.id);
        const products = await this.prisma.client.product.findMany({
          where: { categoryId: { in: categoryIds }, isActive: true },
          select: { id: true },
        });
        productIds = products.map((p) => p.id);
        if (productIds.length === 0) return [];
      }
    }

    const facets = [];
    for (const attribute of attributes) {
      const values = await this.prisma.client.attributeValue.findMany({
        where: {
          attributeId: attribute.id,
          ...(productIds
            ? {
                OR: [
                  { productId: { in: productIds } },
                  { variant: { productId: { in: productIds } } },
                ],
              }
            : {}),
        },
        select: { valueString: true, valueDecimal: true },
        distinct: ['valueString'],
        orderBy: [{ valueDecimal: 'asc' }, { valueString: 'asc' }],
        take: 50,
      });

      if (values.length > 1) {
        facets.push({
          name: attribute.name,
          slug: attribute.slug,
          unit: attribute.unit,
          dataType: attribute.dataType,
          isNumeric: values.every((v) => v.valueDecimal !== null),
          values: values.map((v) => v.valueString).filter((v): v is string => v !== null),
        });
      }
    }

    return facets;
  }

  // ── Machines ──────────────────────────────────────────────────────────

  /**
   * The whole brand -> model -> variant tree in one payload.
   *
   * The compatibility finder is three dependent dropdowns; served as three
   * endpoints it would cost three sequential round trips on mobile 4G before
   * the user can act, which is exactly the friction the finder exists to
   * remove. The tree is small and changes rarely, so it ships as one cacheable
   * response.
   */
  async findMachineTree() {
    return this.prisma.client.machineBrand.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        models: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            variants: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, laserType: true, powerWatts: true },
            },
          },
        },
      },
    });
  }

  // ── Search ────────────────────────────────────────────────────────────

  /**
   * Three-stage search.
   *
   *   1. EXACT match on the normalised search key
   *   2. PREFIX match on the same key
   *   3. MySQL FULLTEXT across product name and description
   *
   * Stages 1 and 2 come first because FULLTEXT splits on punctuation and drops
   * short tokens: "D27.9 T4.1" degrades to a search for "D27" and returns
   * nothing. A customer typing their exact part number and being told it does
   * not exist is the worst outcome this site can produce.
   */
  async search(term: string, limit: number, offset: number) {
    const key = normalizeSearchKey(term);

    if (key.length > 0) {
      const exact = await this.prisma.client.productVariant.findMany({
        where: { searchKey: { startsWith: key }, isActive: true },
        select: { productId: true, searchKey: true },
        take: 200,
      });

      if (exact.length > 0) {
        // An exact key match outranks a prefix match.
        const exactIds = exact
          .filter((v) => v.searchKey.split(' ').includes(key))
          .map((v) => v.productId);
        const prefixIds = exact.map((v) => v.productId);
        const ordered = [...new Set([...exactIds, ...prefixIds])];

        const items = await this.prisma.client.product.findMany({
          where: { id: { in: ordered }, isActive: true, deletedAt: null },
          select: CARD_SELECT,
        });

        // Preserve the ranking the id ordering established.
        const byId = new Map(items.map((item) => [item.id, item]));
        const ranked = ordered
          .map((id) => byId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p));

        return {
          items: ranked.slice(offset, offset + limit),
          total: ranked.length,
          matchType: 'part_number' as const,
        };
      }
    }

    // Stage 3: full text over the product record.
    const words = term.trim().split(/\s+/).filter(Boolean);
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      OR: words.flatMap((word) => [
        { name: { contains: word } },
        { shortDescription: { contains: word } },
      ]),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        select: CARD_SELECT,
        orderBy: [{ isFeatured: 'desc' }, { hasStock: 'desc' }, { name: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return { items, total, matchType: 'text' as const };
  }

  async logSearch(data: {
    query: string;
    normalized: string;
    resultCount: number;
    sessionId?: number;
  }) {
    // Zero-result searches are the most commercially valuable signal the site
    // produces: a list of parts customers want that LEI does not stock or has
    // not listed correctly.
    await this.prisma.raw.searchQueryLog.create({ data });
  }

  // ── Homepage ──────────────────────────────────────────────────────────

  async findFeaturedProducts(limit = 10) {
    return this.prisma.client.product.findMany({
      where: { isActive: true, isFeatured: true, deletedAt: null },
      select: CARD_SELECT,
      take: limit,
      orderBy: [{ hasStock: 'desc' }, { name: 'asc' }],
    });
  }

  async findTopProducts(limit = 10) {
    return this.prisma.client.product.findMany({
      // Stock is a preference in the ordering, NOT a filter. LEI quotes rather
      // than sells from a shelf, and a catalogue whose parts are all
      // made-to-order would otherwise leave the homepage permanently empty —
      // which is exactly what "no stock figure published" produced.
      where: { isActive: true, deletedAt: null },
      select: CARD_SELECT,
      take: limit,
      orderBy: [{ isFeatured: 'desc' }, { hasStock: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
