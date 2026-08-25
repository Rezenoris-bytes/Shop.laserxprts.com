import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  productListQuerySchema,
  resolveVariantsSchema,
  searchQuerySchema,
  type ProductListQuery,
  type ResolveVariantsInput,
  type SearchQuery,
} from '@lei/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodQuery } from '../common/pipes/zod-validation.pipe';
import { CatalogueService } from './catalogue.service';

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
  constructor(private readonly catalogue: CatalogueService) {}

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

  /** Brand -> model -> variant tree for the compatibility finder, in one call. */
  @Public()
  @Get('machines/tree')
  machineTree() {
    return this.catalogue.getMachineTree();
  }
}
