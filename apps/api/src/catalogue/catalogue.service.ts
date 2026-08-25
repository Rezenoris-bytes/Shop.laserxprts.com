import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeSearchKey, type ProductListQuery } from '@lei/shared';
import { CatalogueRepository, type AttributeFilter } from './catalogue.repository';

/** A specification value as both the listing and detail selects return it. */
interface ListingAttributeValue {
  valueString: string | null;
  attribute: { name: string; slug: string; unit: string | null; sortOrder: number };
}

interface ListingVariant {
  id: number;
  sku: string;
  partNumber: string;
  mpn: string | null;
  variantName: string;
  price: unknown;
  priceType: string;
  mrp: unknown;
  unitOfMeasure: string;
  packSize: number;
  minOrderQty: number;
  leadTimeDays: number | null;
  isDefault: boolean;
  attributeValues: ListingAttributeValue[];
}

interface ListingRow {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  minPrice: unknown;
  maxPrice: unknown;
  variantAxes: unknown;
  isSeedData: boolean;
  category: { name: string; slug: string } | null;
  partBrand: { name: string; slug: string } | null;
  media: Array<{
    id: number;
    altText: string | null;
    isPrimary: boolean;
    file: { storedName: string; path: string; width: number | null; height: number | null };
  }>;
  attributeValues: ListingAttributeValue[];
  variants: ListingVariant[];
  _count: { variants: number };
}

/** A product as it appears in a category's sidebar preview and tile artwork. */
interface CategoryPreviewProduct {
  name: string;
  slug: string;
  image: { storedName: string; path: string } | null;
}

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
      data: items.map((item) => this.toListing(item)),
      meta: {
        pagination: this.pagination(query.page, query.perPage, total),
        appliedFilters: filters,
      },
    };
  }

  /** How many product links the sidebar shows before "View more". */
  private static readonly CATEGORY_PREVIEW_SIZE = 5;

  async getCategoryTree() {
    const [flat, previewProducts] = await Promise.all([
      this.repository.findCategoryTree(),
      this.repository.findCategoryProductPreviews(),
    ]);

    const byParent = new Map<number | null, typeof flat>();
    for (const category of flat) {
      const key = category.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(category);
    }

    const byCategory = new Map<number, CategoryPreviewProduct[]>();
    for (const product of previewProducts) {
      const bucket = byCategory.get(product.categoryId) ?? [];
      bucket.push({
        name: product.name,
        slug: product.slug,
        image: product.media[0]
          ? { storedName: product.media[0].file.storedName, path: product.media[0].file.path }
          : null,
      });
      byCategory.set(product.categoryId, bucket);
    }

    const build = (parentId: number | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((category) => {
        // A parent's panel would otherwise look empty when every product sits
        // on a leaf, so it borrows its descendants' names.
        const products = this.previewFor(category.id, byParent, byCategory);
        return {
          ...category,
          products: products.map(({ name, slug }) => ({ name, slug })),
          image: products.find((product) => product.image)?.image ?? null,
          children: build(category.id),
        };
      });

    return build(null);
  }

  private previewFor(
    categoryId: number,
    byParent: Map<number | null, Array<{ id: number }>>,
    byCategory: Map<number, CategoryPreviewProduct[]>,
  ): CategoryPreviewProduct[] {
    const collected: CategoryPreviewProduct[] = [];
    const frontier = [categoryId];

    while (frontier.length > 0 && collected.length < CatalogueService.CATEGORY_PREVIEW_SIZE) {
      const current = frontier.shift()!;
      collected.push(...(byCategory.get(current) ?? []));
      frontier.push(...(byParent.get(current) ?? []).map((child) => child.id));
    }

    return collected.slice(0, CatalogueService.CATEGORY_PREVIEW_SIZE);
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
    const variants = product.variants.map((variant) => this.toVariantView(variant, axes));

    const axisDefinitions = this.axisDefinitions(axes, product.variants);

    const related = await this.repository.findRelatedByCompatibility(product.id);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      productType: product.productType,
      priceRange: {
        min: product.minPrice === null ? null : Number(product.minPrice),
        max: product.maxPrice === null ? null : Number(product.maxPrice),
      },
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
        path: media.file.path,
        width: media.file.width,
        height: media.file.height,
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
        isDefault: variant.isDefault,
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

  async searchAutocomplete(term: string, limit = 5) {
    const items = await this.repository.autocompleteSearch(term, limit);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.media[0]
        ? {
            storedName: item.media[0].file.storedName,
            path: item.media[0].file.path,
          }
        : null,
    }));
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

  // ── Shared shaping ────────────────────────────────────────────────────
  // Used by BOTH the detail payload and the catalogue rows. Kept in one place
  // deliberately: two copies of the axis logic would let a variant selector
  // that works on one surface quietly stop working on the other.

  private toVariantView(variant: ListingVariant, axes: string[]) {
    return {
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
    };
  }

  private sharedSpecs(values: ListingAttributeValue[]) {
    return values
      .filter((value) => value.valueString !== null && value.valueString !== '')
      .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
      .map((value) => ({
        name: value.attribute.name,
        slug: value.attribute.slug,
        value: value.valueString ?? '',
        unit: value.attribute.unit,
      }));
  }

  private axisDefinitions(axes: string[], variants: ListingVariant[]) {
    return axes.map((slug) => {
      const source = variants
        .flatMap((variant) => variant.attributeValues)
        .find((value) => value.attribute.slug === slug);

      const values = [
        ...new Set(
          variants
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
  }

  /**
   * A catalogue row.
   *
   * Rows carry what a product page used to: gallery, full specification table
   * and sellable variants. The variant and axis shaping is the SAME code the
   * detail payload uses, so the selector cannot behave differently in a row
   * than it did on a page.
   */
  private toListing(product: ListingRow) {
    const axes = Array.isArray(product.variantAxes) ? (product.variantAxes as string[]) : [];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      priceFrom: product.minPrice === null ? null : Number(product.minPrice),
      priceTo: product.maxPrice === null ? null : Number(product.maxPrice),
      variantCount: product._count.variants,
      defaultVariant: (() => {
        const preferred =
          product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
        return preferred ? { id: preferred.id, minOrderQty: preferred.minOrderQty } : null;
      })(),
      isSeedData: product.isSeedData,
      category: product.category,
      brand: product.partBrand,
      image: product.media[0]
        ? {
            storedName: product.media[0].file.storedName,
            path: product.media[0].file.path,
            alt: product.media[0].altText,
          }
        : null,
      images: product.media.map((media) => ({
        id: media.id,
        alt: media.altText,
        isPrimary: media.isPrimary,
        storedName: media.file.storedName,
        path: media.file.path,
        width: media.file.width,
        height: media.file.height,
      })),
      specs: this.sharedSpecs(product.attributeValues),
      axes: this.axisDefinitions(axes, product.variants),
      variants: product.variants.map((variant) => this.toVariantView(variant, axes)),
    };
  }

  private toCard(product: {
    id: number;
    name: string;
    slug: string;
    shortDescription: string | null;
    minPrice: unknown;
    maxPrice: unknown;
    variantAxes: unknown;
    isSeedData: boolean;
    category: { name: string; slug: string } | null;
    partBrand: { name: string; slug: string } | null;
    media: Array<{ altText: string | null; file: { storedName: string; path: string } }>;
    attributeValues: Array<{
      valueString: string | null;
      attribute: { name: string; slug: string; unit: string | null; sortOrder: number };
    }>;
    variants: Array<{ id: number; minOrderQty: number }>;
    _count: { variants: number };
  }) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      priceFrom: product.minPrice === null ? null : Number(product.minPrice),
      priceTo: product.maxPrice === null ? null : Number(product.maxPrice),
      variantCount: product._count.variants,
      defaultVariant: product.variants[0]
        ? { id: product.variants[0].id, minOrderQty: product.variants[0].minOrderQty }
        : null,
      isSeedData: product.isSeedData,
      category: product.category,
      brand: product.partBrand,
      image: product.media[0]
        ? {
            storedName: product.media[0].file.storedName,
            path: product.media[0].file.path,
            alt: product.media[0].altText,
          }
        : null,
      specs: product.attributeValues
        .filter((value) => value.valueString !== null && value.valueString !== '')
        .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
        .map((value) => ({
          name: value.attribute.name,
          slug: value.attribute.slug,
          value: value.valueString ?? '',
          unit: value.attribute.unit,
        })),
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
