import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import {
  COMPONENT_KIND_SLUGS,
  productListQuerySchema,
  resolveVariantsSchema,
  searchQuerySchema,
  type ComponentKindSlug,
  type ProductListQuery,
  type ResolveVariantsInput,
  type SearchQuery,
} from '@lei/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodQuery } from '../common/pipes/zod-validation.pipe';
import { CatalogueService } from './catalogue.service';
import { NozzleFamilyService } from './nozzle-family.service';

/**
 * Public catalogue API.
 *
 * Everything here is @Public() — the storefront is anonymous by design; there
 * is no customer login in Phase 1. Every list endpoint is paginated with a
 * server-side cap enforced by the shared pagination schema, so "never return
 * unbounded lists" holds without each endpoint remembering to.
 */
@Controller()
export class CatalogueController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly nozzleFamily: NozzleFamilyService,
  ) {}

  /** Everything the homepage needs, in one request. */
  @Public()
  @Get('home')
  home() {
    return this.catalogue.getHomepage();
  }

  @Public()
  @Get('categories')
  categories() {
    return this.catalogue.getCategoryTree();
  }

  @Public()
  @Get('categories/:slug')
  category(@Param('slug') slug: string) {
    return this.catalogue.getCategory(slug);
  }

  @Public()
  @Get('products')
  products(@Query(ZodQuery(productListQuerySchema)) query: ProductListQuery) {
    return this.catalogue.listProducts(query);
  }

  /** Filter sidebar options, scoped to a category when one is given. */
  @Public()
  @Get('facets')
  facets(@Query('category') category?: string) {
    return this.catalogue.getFacets(category);
  }

  /**
   * Product family view for categories that benefit from grouped selectors.
   *
   * Returns products clustered into families with option groups (e.g. Layer,
   * Cut Type, Size) so the storefront can render a single card per family
   * instead of one card per DB product. The variantMap in each family
   * resolves any valid option combination to the exact original SKU.
   *
   * ?category= is required; the caller must pass a category slug.
   *
   * MUST stay above `products/:slug`: Nest matches in declaration order, so
   * with the specific route second, /products/families is swallowed by the
   * slug handler and 404s looking for a product named "families".
   */
  @Public()
  @Get('products/families')
  productFamilies(@Query('category') category: string) {
    return this.nozzleFamily.getFamilies(category ?? '');
  }

  @Public()
  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalogue.getProduct(slug);
  }

  /**
   * Quote Request rehydration.
   *
   * The browser holds variant ids and quantities only. Prices always come from
   * here, so editing localStorage cannot change what a request is worth.
   */
  @Public()
  @Get('variants/resolve')
  resolveVariants(@Query(ZodQuery(resolveVariantsSchema)) query: ResolveVariantsInput) {
    return this.catalogue.resolveVariants(query.ids);
  }

  @Public()
  @Get('search/autocomplete')
  searchAutocomplete(@Query('q') query: string) {
    return this.catalogue.searchAutocomplete(query || '');
  }

  @Public()
  @Get('search')
  search(@Query(ZodQuery(searchQuerySchema)) query: SearchQuery) {
    return this.catalogue.search(query.q, query.page, query.perPage);
  }

  /** Machine brand -> model -> variant tree for the compatibility finder. */
  @Public()
  @Get('machines/tree')
  machineTree() {
    return this.catalogue.getMachineTree('MACHINE');
  }

  /**
   * The same tree for cutting heads, which Find My Part asks for after the
   * machine. A cutting head brand is a different entity from a machine brand —
   * the same head fits machines from many makers — so it is its own endpoint
   * rather than a filter the caller might forget to apply.
   */
  @Public()
  @Get('cutting-heads/tree')
  cuttingHeadTree() {
    return this.catalogue.getMachineTree('CUTTING_HEAD');
  }

  /**
   * The remaining component trees (§8), one route per kind.
   *
   * A single `/components/:kind/tree` rather than four more copies of the two
   * above: the kind is validated against the URL-segment map, so an unknown
   * segment 404s instead of silently falling back to MACHINE and offering a
   * chiller owner a list of press brakes.
   */
  @Public()
  @Get('components/:kind/tree')
  componentTree(@Param('kind') kind: string) {
    return this.catalogue.getMachineTree(this.resolveKind(kind));
  }

  /** §14 — brand directory for one kind, e.g. /components/cutting-heads/brands. */
  @Public()
  @Get('components/:kind/brands')
  componentBrands(@Param('kind') kind: string) {
    return this.catalogue.getBrands(this.resolveKind(kind));
  }

  @Public()
  @Get('components/:kind/brands/:brand')
  componentBrand(@Param('kind') kind: string, @Param('brand') brand: string) {
    return this.catalogue.getBrand(this.resolveKind(kind), brand);
  }

  /** §15 — a component model page, e.g. /components/cutting-heads/brands/raytools/bm111. */
  @Public()
  @Get('components/:kind/brands/:brand/:model')
  componentModel(
    @Param('kind') kind: string,
    @Param('brand') brand: string,
    @Param('model') model: string,
  ) {
    return this.catalogue.getComponentModel(this.resolveKind(kind), brand, model);
  }

  /**
   * URL segment -> ComponentKind, or 404.
   *
   * Rejecting an unknown segment matters more than it looks: without it, a
   * typo would fall through to the MACHINE default and confidently answer a
   * chiller question with a list of press brakes.
   */
  private resolveKind(kind: string) {
    const resolved = COMPONENT_KIND_SLUGS[kind as ComponentKindSlug];
    if (!resolved) {
      throw new NotFoundException(`Unknown component kind: ${kind}`);
    }
    return resolved;
  }

}
