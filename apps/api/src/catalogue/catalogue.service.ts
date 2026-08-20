import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeSearchKey, type ProductListQuery } from '@lei/shared';
import { CatalogueRepository, type AttributeFilter } from './catalogue.repository';

@Injectable()
export class CatalogueService {
  constructor(private readonly repository: CatalogueRepository) {}

  /**
   * Parses `attr=slug:value` and `attr=slug:1.0..3.0` filter params.
   *
   * Range syntax exists because the most valuable filters in a technical parts
   * catalogue are numeric — nozzle diameter, focal length, thickness.
   */
  parseAttributeFilters(raw: string[]): AttributeFilter[] {
    const filters: AttributeFilter[] = [];

    for (const entry of raw) {
      const separator = entry.indexOf(':');
      if (separator <= 0) continue;

      const slug = entry.slice(0, separator).trim();
      const value = entry.slice(separator + 1).trim();
      if (!slug || !value) continue;

      if (value.includes('..')) {
        const [from, to] = value.split('..');
        const min = Number(from);
        const max = Number(to);
        filters.push({
          slug,
          min: Number.isFinite(min) ? min : undefined,
          max: Number.isFinite(max) ? max : undefined,
        });
      } else {
        filters.push({ slug, value });
      }
    }

    return filters;
  }

  async listProducts(query: ProductListQuery) {
    const filters = this.parseAttributeFilters(query.attr);
    const { items, total } = await this.repository.listProducts(query, filters);

    return {
      data: items.map((item) => this.toCard(item)),
      meta: {
        pagination: this.pagination(query.page, query.perPage, total),
        appliedFilters: filters,
      },
    };
  }

  async getCategoryTree() {
    const flat = await this.repository.findCategoryTree();
    const byParent = new Map<number | null, typeof flat>();
    for (const category of flat) {
      const key = category.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(category);
    }

    const build = (parentId: number | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: build(category.id),
      }));

    return build(null);
  }

  async getCategory(slug: string) {
    const category = await this.repository.findCategoryBySlug(slug);
    if (!category) throw new NotFoundException(`Category "${slug}" not found`);
    return category;
  }

  async getProduct(slug: string) {
    const product = await this.repository.findProductBySlug(slug);
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    const axes = Array.isArray(product.variantAxes) ? (product.variantAxes as string[]) : [];

    // Shared specs are attributes with one distinct value across variants, plus
    // everything recorded at product level. Selector axes are the rest. The
    // split is derived from the data, so one component renders every family.
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      partNumber: variant.partNumber,
      mpn: variant.mpn,
      name: variant.variantName,
      price: variant.price === null ? null : Number(variant.price),
      priceType: variant.priceType,
      mrp: variant.mrp === null ? null : Number(variant.mrp),
      unitOfMeasure: variant.unitOfMeasure,
      packSize: variant.packSize,
      minOrderQty: variant.minOrderQty,
      leadTimeDays: variant.leadTimeDays,
      isDefault: variant.isDefault,
      stockStatus: variant.inventory?.stockStatus ?? 'OUT_OF_STOCK',
      inStock: (variant.inventory?.quantity ?? 0) > 0,
      // Axis values keyed by slug — what the selector reads.
      axisValues: Object.fromEntries(
        variant.attributeValues
          .filter((value) => axes.includes(value.attribute.slug))
          .map((value) => [value.attribute.slug, value.valueString ?? '']),
      ),
      specs: variant.attributeValues
        .filter((value) => !axes.includes(value.attribute.slug))
        .map((value) => ({
          name: value.attribute.name,
          slug: value.attribute.slug,
          value: value.valueString ?? '',
          unit: value.attribute.unit,
        })),
    }));

    const axisDefinitions = axes.map((slug) => {
      const source = product.variants
        .flatMap((variant) => variant.attributeValues)
        .find((value) => value.attribute.slug === slug);

      const values = [
        ...new Set(
          product.variants
            .map(
              (variant) =>
                variant.attributeValues.find((value) => value.attribute.slug === slug)?.valueString,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
      });

      return {
        slug,
        name: source?.attribute.name ?? slug,
        unit: source?.attribute.unit ?? null,
        values,
      };
    });

    const related = await this.repository.findRelatedByCompatibility(product.id);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      productType: product.productType,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate === null ? null : Number(product.gstRate),
      priceRange: {
        min: product.minPrice === null ? null : Number(product.minPrice),
        max: product.maxPrice === null ? null : Number(product.maxPrice),
      },
      hasStock: product.hasStock,
      isSeedData: product.isSeedData,
      seo: {
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        ogTitle: product.ogTitle,
        ogDescription: product.ogDescription,
        indexable: product.seoIndexable,
      },
      category: product.category,
      brand: product.partBrand,
      images: product.media.map((media) => ({
        id: media.id,
        alt: media.altText,
        isPrimary: media.isPrimary,
        storedName: media.file.storedName,
      })),
      // Product-level attributes are shared specs by definition.
      specs: product.attributeValues
        .filter((value) => value.attribute.showInSpecs)
        .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
        .map((value) => ({
          name: value.attribute.name,
          slug: value.attribute.slug,
          value: value.valueString ?? '',
          unit: value.attribute.unit,
        })),
      axes: axisDefinitions,
      variants,
      compatibility: product.compatibility.map((row) => ({
        id: row.id,
        variantId: row.variantId,
        brand: row.machineBrand,
        model: row.machineModel,
        machineVariant: row.machineVariant,
        notes: row.notes,
        // Claimed vs engineer-confirmed. Wrong fitment costs more than missing
        // fitment, so the UI must show the difference.
        isVerified: row.isVerified,
        isSeedData: row.isSeedData,
      })),
      related: related.map((item) => this.toCard(item)),
    };
  }

  async resolveVariants(ids: number[]) {
    const variants = await this.repository.resolveVariants(ids);
    const found = new Set(variants.map((variant) => variant.id));

    return {
      items: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        partNumber: variant.partNumber,
        name: variant.variantName,
        price: variant.price === null ? null : Number(variant.price),
        priceType: variant.priceType,
        unitOfMeasure: variant.unitOfMeasure,
        packSize: variant.packSize,
        minOrderQty: variant.minOrderQty,
        stockStatus: variant.inventory?.stockStatus ?? 'OUT_OF_STOCK',
        product: {
          id: variant.product.id,
          name: variant.product.name,
          slug: variant.product.slug,
          image: variant.product.media[0]?.file.storedName ?? null,
        },
      })),
      // The basket shows these as "no longer available" and keeps the rest,
      // rather than failing the whole request.
      unavailable: ids.filter((id) => !found.has(id)),
    };
  }

  async search(term: string, page: number, perPage: number, sessionId?: number) {
    const offset = (page - 1) * perPage;
    const result = await this.repository.search(term, perPage, offset);

    await this.repository.logSearch({
      query: term.slice(0, 255),
      normalized: normalizeSearchKey(term).slice(0, 255),
      resultCount: result.total,
      sessionId,
    });

    return {
      data: result.items.map((item) => this.toCard(item)),
      meta: {
        pagination: this.pagination(page, perPage, result.total),
        query: term,
        matchType: result.matchType,
      },
    };
  }

  async getFacets(categorySlug?: string) {
    return this.repository.facetsForCategory(categorySlug);
  }

  async getMachineTree() {
    return this.repository.findMachineTree();
  }

  async getHomepage() {
    const [categories, featured, top] = await Promise.all([
      this.getCategoryTree(),
      this.repository.findFeaturedProducts(8),
      this.repository.findTopProducts(10),
    ]);

    return {
      categories,
      featured: featured.map((item) => this.toCard(item)),
      topProducts: top.map((item) => this.toCard(item)),
    };
  }

  // ── Shaping ───────────────────────────────────────────────────────────

  private toCard(product: {
    id: number;
    name: string;
    slug: string;
    shortDescription: string | null;
    minPrice: unknown;
    maxPrice: unknown;
    hasStock: boolean;
    variantAxes: unknown;
    isSeedData: boolean;
    category: { name: string; slug: string } | null;
    partBrand: { name: string; slug: string } | null;
    media: Array<{ altText: string | null; file: { storedName: string } }>;
    _count: { variants: number };
  }) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      priceFrom: product.minPrice === null ? null : Number(product.minPrice),
      priceTo: product.maxPrice === null ? null : Number(product.maxPrice),
      hasStock: product.hasStock,
      variantCount: product._count.variants,
      isSeedData: product.isSeedData,
      category: product.category,
      brand: product.partBrand,
      image: product.media[0]
        ? { storedName: product.media[0].file.storedName, alt: product.media[0].altText }
        : null,
    };
  }

  private pagination(page: number, perPage: number, total: number) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    return {
      page,
      perPage,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
