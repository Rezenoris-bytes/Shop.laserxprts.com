import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  PermissionAction,
  PermissionModule,
  adminListQuerySchema,
  createAttributeSchema,
  createMachineBrandSchema,
  createMachineModelSchema,
  createMachineVariantSchema,
  updateInventorySchema,
  upsertCategorySchema,
  upsertCompatibilitySchema,
  upsertPartBrandSchema,
  upsertProductSchema,
  upsertVariantSchema,
  type AdminListQuery,
  type CreateAttributeInput,
  type CreateMachineBrandInput,
  type CreateMachineModelInput,
  type CreateMachineVariantInput,
  type UpdateInventoryInput,
  type UpsertCategoryInput,
  type UpsertCompatibilityInput,
  type UpsertPartBrandInput,
  type UpsertProductInput,
  type UpsertVariantInput,
} from '@lei/shared';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody, ZodQuery } from '../common/pipes/zod-validation.pipe';
import { AdminCatalogueService } from './admin-catalogue.service';

const CAT = PermissionModule.CATALOGUE;
const INV = PermissionModule.INVENTORY;
const MACH = PermissionModule.MACHINES;

@Controller('admin')
export class AdminCatalogueController {
  constructor(private readonly service: AdminCatalogueService) {}

  // ── Categories ────────────────────────────────────────────────────────

  @Get('categories')
  @RequirePermission(CAT, PermissionAction.VIEW)
  listCategories() {
    return this.service.listCategories();
  }

  @Post('categories')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createCategory(
    @Body(ZodBody(upsertCategorySchema)) body: UpsertCategoryInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createCategory(body, actorId);
  }

  @Patch('categories/:id')
  @RequirePermission(CAT, PermissionAction.UPDATE)
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertCategorySchema.partial())) body: Partial<UpsertCategoryInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateCategory(id, body, actorId);
  }

  @Delete('categories/:id')
  @RequirePermission(CAT, PermissionAction.DELETE)
  deleteCategory(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteCategory(id, actorId);
  }

  // ── Part brands ───────────────────────────────────────────────────────

  @Get('part-brands')
  @RequirePermission(CAT, PermissionAction.VIEW)
  listPartBrands() {
    return this.service.listPartBrands();
  }

  @Post('part-brands')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createPartBrand(
    @Body(ZodBody(upsertPartBrandSchema)) body: UpsertPartBrandInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createPartBrand(body, actorId);
  }

  @Patch('part-brands/:id')
  @RequirePermission(CAT, PermissionAction.UPDATE)
  updatePartBrand(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertPartBrandSchema.partial())) body: Partial<UpsertPartBrandInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updatePartBrand(id, body, actorId);
  }

  // ── Products ──────────────────────────────────────────────────────────

  @Get('products')
  @RequirePermission(CAT, PermissionAction.VIEW)
  listProducts(
    @Query(ZodQuery(adminListQuerySchema)) query: AdminListQuery,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.listProducts(query, categoryId ? Number(categoryId) : undefined);
  }

  @Get('products/:id')
  @RequirePermission(CAT, PermissionAction.VIEW)
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProduct(id);
  }

  @Post('products')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createProduct(
    @Body(ZodBody(upsertProductSchema)) body: UpsertProductInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createProduct(body, actorId);
  }

  @Patch('products/:id')
  @RequirePermission(CAT, PermissionAction.UPDATE)
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertProductSchema.partial())) body: Partial<UpsertProductInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateProduct(id, body, actorId);
  }

  @Delete('products/:id')
  @RequirePermission(CAT, PermissionAction.DELETE)
  deleteProduct(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteProduct(id, actorId);
  }

  // ── Variants ──────────────────────────────────────────────────────────

  @Post('variants')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createVariant(
    @Body(ZodBody(upsertVariantSchema)) body: UpsertVariantInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createVariant(body, actorId);
  }

  @Patch('variants/:id')
  @RequirePermission(CAT, PermissionAction.UPDATE)
  updateVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertVariantSchema.partial().extend({ productId: upsertVariantSchema.shape.productId })))
    body: Partial<UpsertVariantInput> & { productId: number },
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateVariant(id, body.productId, body, actorId);
  }

  // ── Inventory ─────────────────────────────────────────────────────────

  @Patch('variants/:id/inventory')
  @RequirePermission(INV, PermissionAction.UPDATE)
  updateInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(updateInventorySchema.extend({ productId: upsertVariantSchema.shape.productId })))
    body: UpdateInventoryInput & { productId: number },
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateInventory(id, body.productId, body, actorId);
  }

  @Get('variants/:id/stock-movements')
  @RequirePermission(INV, PermissionAction.VIEW)
  stockMovements(@Param('id', ParseIntPipe) id: number) {
    return this.service.stockMovements(id);
  }

  // ── Compatibility ─────────────────────────────────────────────────────

  @Post('compatibility')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createCompatibility(
    @Body(ZodBody(upsertCompatibilitySchema)) body: UpsertCompatibilityInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createCompatibility(body, actorId);
  }

  @Patch('compatibility/:id/verify')
  @RequirePermission(CAT, PermissionAction.UPDATE)
  verifyCompatibility(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.verifyCompatibility(id, actorId);
  }

  @Delete('compatibility/:id')
  @RequirePermission(CAT, PermissionAction.DELETE)
  deleteCompatibility(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteCompatibility(id, actorId);
  }

  // ── Machines ──────────────────────────────────────────────────────────

  @Get('machines')
  @RequirePermission(MACH, PermissionAction.VIEW)
  listMachines() {
    return this.service.listMachineBrands();
  }

  @Post('machines/brands')
  @RequirePermission(MACH, PermissionAction.CREATE)
  createMachineBrand(@Body(ZodBody(createMachineBrandSchema)) body: CreateMachineBrandInput) {
    return this.service.createMachineBrand(body.name);
  }

  @Post('machines/models')
  @RequirePermission(MACH, PermissionAction.CREATE)
  createMachineModel(@Body(ZodBody(createMachineModelSchema)) body: CreateMachineModelInput) {
    return this.service.createMachineModel(body.machineBrandId, body.name);
  }

  @Post('machines/variants')
  @RequirePermission(MACH, PermissionAction.CREATE)
  createMachineVariant(@Body(ZodBody(createMachineVariantSchema)) body: CreateMachineVariantInput) {
    return this.service.createMachineVariant(body.machineModelId, body.name, body.laserType, body.powerWatts);
  }

  // ── Attributes ────────────────────────────────────────────────────────

  @Get('attributes')
  @RequirePermission(CAT, PermissionAction.VIEW)
  listAttributes() {
    return this.service.listAttributes();
  }

  @Post('attributes')
  @RequirePermission(CAT, PermissionAction.CREATE)
  createAttribute(@Body(ZodBody(createAttributeSchema)) body: CreateAttributeInput) {
    return this.service.createAttribute(body);
  }
}
