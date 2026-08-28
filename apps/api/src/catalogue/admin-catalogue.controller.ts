import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {


  adminListQuerySchema,
  createAttributeSchema,
  createMachineBrandSchema,
  createMachineModelSchema,
  createMachineVariantSchema,
  upsertCategorySchema,
  upsertCompatibilitySchema,
  upsertPartBrandSchema,
  reorderMediaSchema,
  upsertProductSchema,
  upsertVariantSchema,
  type AdminListQuery,
  type CreateAttributeInput,
  type ComponentKind,
  type CreateMachineBrandInput,
  type CreateMachineModelInput,
  type CreateMachineVariantInput,
  type UpsertCategoryInput,
  type UpsertCompatibilityInput,
  type UpsertPartBrandInput,
  type ReorderMediaInput,
  type UpsertProductInput,
  type UpsertVariantInput,
} from '@lei/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody, ZodQuery } from '../common/pipes/zod-validation.pipe';
import { AdminCatalogueService } from './admin-catalogue.service';
import { BulkProductUploadService } from './import/bulk-product-upload.service';
import { CompatibilityImportService } from './import/compatibility-import.service';




@Controller('admin')
export class AdminCatalogueController {
  constructor(
    private readonly service: AdminCatalogueService,
    private readonly bulkUpload: BulkProductUploadService,
    private readonly compatibilityImport: CompatibilityImportService,
  ) { }

  // ── Categories ────────────────────────────────────────────────────────

  @Get('categories')

  listCategories() {
    return this.service.listCategories();
  }

  @Post('categories')

  createCategory(
    @Body(ZodBody(upsertCategorySchema)) body: UpsertCategoryInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createCategory(body, actorId);
  }

  @Patch('categories/:id')

  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertCategorySchema.partial())) body: Partial<UpsertCategoryInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateCategory(id, body, actorId);
  }

  @Delete('categories/:id')

  deleteCategory(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteCategory(id, actorId);
  }

  // ── Part brands ───────────────────────────────────────────────────────

  @Get('part-brands')

  listPartBrands() {
    return this.service.listPartBrands();
  }

  @Post('part-brands')

  createPartBrand(
    @Body(ZodBody(upsertPartBrandSchema)) body: UpsertPartBrandInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createPartBrand(body, actorId);
  }

  @Patch('part-brands/:id')

  updatePartBrand(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertPartBrandSchema.partial())) body: Partial<UpsertPartBrandInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updatePartBrand(id, body, actorId);
  }

  // ── Products ──────────────────────────────────────────────────────────

  @Get('products')

  listProducts(
    @Query(ZodQuery(adminListQuerySchema)) query: AdminListQuery,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.listProducts(query, categoryId ? Number(categoryId) : undefined);
  }

  @Get('products/:id')

  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProduct(id);
  }

  @Post('products')

  createProduct(
    @Body(ZodBody(upsertProductSchema)) body: UpsertProductInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createProduct(body, actorId);
  }

  @Patch('products/:id')

  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(upsertProductSchema.partial())) body: Partial<UpsertProductInput>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateProduct(id, body, actorId);
  }

  @Delete('products/:id')

  deleteProduct(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteProduct(id, actorId);
  }

  // ── Bulk upload (CSV / Excel) ────────────────────────────────────────────

  @Get('products/bulk-upload/template')

  async downloadBulkUploadTemplate(@Res() reply: FastifyReply) {
    const buffer = await this.bulkUpload.generateTemplate();
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="product-upload-template.xlsx"')
      .send(buffer);
  }

  @Post('products/bulk-upload')

  async bulkUploadProducts(@Req() request: FastifyRequest, @CurrentUser('id') actorId: number) {
    const uploads = await this.collectUploads(request);
    const first = uploads[0];
    if (!first) throw new BadRequestException('No file was uploaded');
    if (!/\.(csv|xlsx)$/i.test(first.filename)) {
      throw new BadRequestException('Upload a .csv or .xlsx file');
    }
    return this.bulkUpload.importFile(first.buffer, first.filename, actorId);
  }

  // ── Compatibility import (Phase 2) ──────────────────────────────────────

  @Get('compatibility/template')

  async downloadCompatibilityTemplate(@Res() reply: FastifyReply) {
    const buffer = await this.compatibilityImport.generateTemplate();
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="compatibility-import-template.xlsx"')
      .send(buffer);
  }

  /**
   * Imports verified fitment.
   *
   * `?dryRun=true` validates and reports without writing, which is how a file
   * prepared by somebody else should always be run the first time — the
   * rejection list tells you what is wrong before anything reaches the table
   * that drives public compatibility claims.
   */
  @Post('compatibility/import')

  async importCompatibility(
    @Req() request: FastifyRequest,
    @CurrentUser('id') actorId: number,
    @Query('dryRun') dryRun?: string,
  ) {
    const uploads = await this.collectUploads(request);
    const first = uploads[0];
    if (!first) throw new BadRequestException('No file was uploaded');
    return this.compatibilityImport.importFile(
      first.buffer,
      first.filename,
      actorId,
      dryRun === 'true',
    );
  }

  // ── Product media ──────────────────────────────────────────────────────

  @Get('products/:id/media')

  listProductMedia(@Param('id', ParseIntPipe) id: number) {
    return this.service.listProductMedia(id);
  }

  /**
   * Multipart upload of one or more images.
   *
   * The files are buffered here rather than streamed to disk because the
   * service checksums the bytes to deduplicate — it needs the whole file
   * before it can decide where (or whether) to write it. The per-file and
   * per-request ceilings are enforced by the multipart plugin in main.ts.
   */
  @Post('products/:id/media')

  async uploadProductMedia(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: FastifyRequest,
    @CurrentUser('id') actorId: number,
  ) {
    const uploads = await this.collectUploads(request);
    return this.service.addProductMedia(id, uploads, actorId);
  }

  @Patch('products/:id/media/order')

  reorderProductMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(reorderMediaSchema)) body: ReorderMediaInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.reorderProductMedia(id, body.mediaIds, actorId);
  }

  @Patch('products/:id/media/:mediaId/primary')

  setPrimaryProductMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.setPrimaryProductMedia(id, mediaId, actorId);
  }

  @Post('products/:id/media/:mediaId/replace')

  async replaceProductMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @Req() request: FastifyRequest,
    @CurrentUser('id') actorId: number,
  ) {
    const uploads = await this.collectUploads(request);
    const first = uploads[0];
    if (!first) throw new BadRequestException('No replacement image was uploaded');
    return this.service.replaceProductMedia(id, mediaId, first, actorId);
  }

  @Delete('products/:id/media/:mediaId')

  deleteProductMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.deleteProductMedia(id, mediaId, actorId);
  }

  /** Drains a multipart request into buffers. */
  private async collectUploads(
    request: FastifyRequest,
  ): Promise<Array<{ buffer: Buffer; filename: string }>> {
    if (!request.isMultipart()) {
      throw new BadRequestException('Expected a multipart/form-data upload');
    }

    const uploads: Array<{ buffer: Buffer; filename: string }> = [];
    try {
      for await (const part of request.files()) {
        uploads.push({ buffer: await part.toBuffer(), filename: part.filename });
      }
    } catch (error) {
      // Thrown when a part exceeds the configured fileSize limit.
      throw new BadRequestException((error as Error).message);
    }
    return uploads;
  }

  // ── Variants ──────────────────────────────────────────────────────────

  @Post('variants')

  createVariant(
    @Body(ZodBody(upsertVariantSchema)) body: UpsertVariantInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createVariant(body, actorId);
  }

  @Patch('variants/:id')

  updateVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body(
      ZodBody(
        upsertVariantSchema.partial().extend({ productId: upsertVariantSchema.shape.productId }),
      ),
    )
    body: Partial<UpsertVariantInput> & { productId: number },
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.updateVariant(id, body.productId, body, actorId);
  }

  @Delete('variants/:id')

  deleteVariant(
    @Param('id', ParseIntPipe) id: number,
    @Query('productId', ParseIntPipe) productId: number,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.deleteVariant(id, productId, actorId);
  }



  // ── Compatibility ─────────────────────────────────────────────────────

  @Post('compatibility')

  createCompatibility(
    @Body(ZodBody(upsertCompatibilitySchema)) body: UpsertCompatibilityInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.createCompatibility(body, actorId);
  }

  @Patch('compatibility/:id/verify')

  verifyCompatibility(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.verifyCompatibility(id, actorId);
  }

  @Delete('compatibility/:id')

  deleteCompatibility(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.service.deleteCompatibility(id, actorId);
  }

  // ── Machines ──────────────────────────────────────────────────────────

  @Get('machines')

  listMachines(@Query('kind') kind?: string) {
    // Unscoped by default so the admin directory shows all six kinds; pass
    // ?kind= for any picker that must offer only one.
    return this.service.listMachineBrands(kind as ComponentKind | undefined);
  }

  @Post('machines/brands')

  createMachineBrand(@Body(ZodBody(createMachineBrandSchema)) body: CreateMachineBrandInput) {
    return this.service.createMachineBrand(body.name, body.kind);
  }

  @Post('machines/models')

  createMachineModel(@Body(ZodBody(createMachineModelSchema)) body: CreateMachineModelInput) {
    return this.service.createMachineModel(body.machineBrandId, body.name);
  }

  @Post('machines/variants')

  createMachineVariant(@Body(ZodBody(createMachineVariantSchema)) body: CreateMachineVariantInput) {
    return this.service.createMachineVariant(
      body.machineModelId,
      body.name,
      body.laserType,
      body.powerWatts,
    );
  }

  // ── Attributes ────────────────────────────────────────────────────────

  @Get('attributes')

  listAttributes() {
    return this.service.listAttributes();
  }

  @Post('attributes')

  createAttribute(@Body(ZodBody(createAttributeSchema)) body: CreateAttributeInput) {
    return this.service.createAttribute(body);
  }
}
