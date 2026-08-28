import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type AdminListQuery, type ComponentKind } from '@lei/shared';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { AdminCatalogueRepository } from './admin-catalogue.repository';
import { StorefrontRevalidationService } from './storefront-revalidation.service';

@Injectable()
export class AdminCatalogueService {
  constructor(
    private readonly repository: AdminCatalogueRepository,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly revalidation: StorefrontRevalidationService,
  ) { }

  // ── Categories ────────────────────────────────────────────────────────

  listCategories() {
    return this.repository.listCategories();
  }

  async createCategory(
    data: Parameters<AdminCatalogueRepository['createCategory']>[0],
    actorId: number,
  ) {
    const category = await this.repository.createCategory(data);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Category',
      entityId: String(category.id),
      newValues: { name: category.name, slug: category.slug, isActive: category.isActive },
    });
    this.revalidation.revalidateCatalogue();
    return category;
  }

  async updateCategory(id: number, data: Record<string, unknown>, actorId: number) {
    const before = await this.repository.findCategory(id);
    if (!before) throw new NotFoundException('Category not found');

    const category = await this.repository.updateCategory(id, data as never);
    await this.repository.recomputeCategoryCounts();

    const diff = this.audit.diff(
      { name: before.name, isActive: before.isActive, parentId: before.parentId },
      { name: category.name, isActive: category.isActive, parentId: category.parentId },
    );
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Category',
      entityId: String(id),
      oldValues: diff.oldValues,
      newValues: diff.newValues,
    });
    this.revalidation.revalidateCatalogue();
    return category;
  }

  async deleteCategory(id: number, actorId: number) {
    const category = await this.repository.softDeleteCategory(id);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.SOFT_DELETE,
      entityType: 'Category',
      entityId: String(id),
    });
    this.revalidation.revalidateCatalogue();
    return category;
  }

  // ── Part brands ───────────────────────────────────────────────────────

  listPartBrands() {
    return this.repository.listPartBrands();
  }

  async createPartBrand(
    data: Parameters<AdminCatalogueRepository['createPartBrand']>[0],
    actorId: number,
  ) {
    const brand = await this.repository.createPartBrand(data);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'PartBrand',
      entityId: String(brand.id),
      newValues: { name: brand.name },
    });
    return brand;
  }

  async updatePartBrand(id: number, data: Record<string, unknown>, actorId: number) {
    const brand = await this.repository.updatePartBrand(id, data as never);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'PartBrand',
      entityId: String(id),
      newValues: data,
    });
    return brand;
  }

  // ── Products ──────────────────────────────────────────────────────────

  async listProducts(query: AdminListQuery, categoryId?: number) {
    const { items, total } = await this.repository.listProducts({
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      q: query.q,
      categoryId,
    });
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    return {
      data: items,
      meta: {
        pagination: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages,
          hasNext: query.page < totalPages,
          hasPrev: query.page > 1,
        },
      },
    };
  }

  async getProduct(id: number) {
    const product = await this.repository.findProduct(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(
    data: Parameters<AdminCatalogueRepository['createProduct']>[0],
    actorId: number,
  ) {
    const product = await this.repository.createProduct(data);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Product',
      entityId: String(product.id),
      newValues: { name: product.name, slug: product.slug, categoryId: product.categoryId },
    });
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(product.id));
    return product;
  }

  async updateProduct(id: number, data: Record<string, unknown>, actorId: number) {
    const before = await this.repository.findProduct(id);
    if (!before) throw new NotFoundException('Product not found');

    const product = await this.repository.updateProduct(id, data as never);
    await this.repository.recomputeCategoryCounts();

    const diff = this.audit.diff(
      {
        name: before.name,
        isActive: before.isActive,
        categoryId: before.categoryId,
      },
      {
        name: product.name,
        isActive: product.isActive,
        categoryId: product.categoryId,
      },
    );
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: String(id),
      oldValues: diff.oldValues,
      newValues: diff.newValues,
    });
    // Covers publish/unpublish too: isActive is part of this payload, and the
    // storefront must drop an unpublished product promptly rather than serving
    // it for the rest of the cache window.
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(id));
    return product;
  }

  async deleteProduct(id: number, actorId: number) {
    const product = await this.repository.softDeleteProduct(id);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.SOFT_DELETE,
      entityType: 'Product',
      entityId: String(id),
    });
    this.revalidation.revalidateCatalogue();
    return product;
  }

  // ── Product media ──────────────────────────────────────────────────────

  listProductMedia(productId: number) {
    return this.repository.findProductMedia(productId);
  }

  /**
   * Stores uploaded images and attaches them to a product.
   *
   * Partial success is reported rather than thrown: uploading eight photographs
   * and losing all of them because the fourth was a PDF is worse than being
   * told which one failed.
   */
  async addProductMedia(
    productId: number,
    uploads: Array<{ buffer: Buffer; filename: string }>,
    actorId: number,
  ) {
    const product = await this.repository.findProduct(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (uploads.length === 0) throw new BadRequestException('No files were uploaded');

    const failures: Array<{ filename: string; message: string }> = [];
    let added = 0;

    for (const upload of uploads) {
      try {
        const file = await this.files.storeProductImage(upload.buffer, upload.filename, actorId);
        // Alt text defaults to the product name — required for image search and
        // screen readers, and an empty alt on a catalogue photo is a defect.
        await this.repository.attachMedia(productId, file.id, product.name.slice(0, 255));
        added += 1;
      } catch (error) {
        failures.push({ filename: upload.filename, message: (error as Error).message });
      }
    }

    if (added > 0) {
      await this.audit.record({
        userId: actorId,
        action: AuditAction.UPDATE,
        entityType: 'Product',
        entityId: String(productId),
        newValues: { mediaAdded: added },
      });
      this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(productId));
    }

    if (added === 0 && failures.length > 0) {
      throw new BadRequestException(failures[0]!.message);
    }

    return { added, failures, media: await this.repository.findProductMedia(productId) };
  }

  async setPrimaryProductMedia(productId: number, mediaId: number, actorId: number) {
    const media = await this.repository.findMedia(productId, mediaId);
    if (!media) throw new NotFoundException('Image not found on this product');

    await this.repository.setPrimaryMedia(productId, mediaId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: String(productId),
      newValues: { primaryMediaId: mediaId },
    });
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(productId));
    return this.repository.findProductMedia(productId);
  }

  async reorderProductMedia(productId: number, mediaIds: number[], actorId: number) {
    const existing = await this.repository.findProductMedia(productId);
    const known = new Set(existing.map((row) => row.id));

    // Reject an incomplete list rather than silently leaving the omitted images
    // at their old sortOrder, which would interleave them unpredictably.
    if (mediaIds.length !== known.size || mediaIds.some((id) => !known.has(id))) {
      throw new BadRequestException('The order must list every image on this product exactly once');
    }

    await this.repository.reorderMedia(productId, mediaIds);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: String(productId),
      newValues: { mediaOrder: mediaIds.join(',') },
    });
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(productId));
    return this.repository.findProductMedia(productId);
  }

  /** Swaps the file behind one gallery slot, keeping its position and primary flag. */
  async replaceProductMedia(
    productId: number,
    mediaId: number,
    upload: { buffer: Buffer; filename: string },
    actorId: number,
  ) {
    const media = await this.repository.findMedia(productId, mediaId);
    if (!media) throw new NotFoundException('Image not found on this product');

    const file = await this.files.storeProductImage(upload.buffer, upload.filename, actorId);
    await this.repository.updateMedia(productId, mediaId, { fileId: file.id });
    // The outgoing file may still be used by another product, so it is only
    // removed if nothing references it any more.
    if (file.id !== media.fileId) await this.files.deleteIfOrphaned(media.fileId);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: String(productId),
      oldValues: { mediaFileId: media.fileId },
      newValues: { mediaFileId: file.id },
    });
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(productId));
    return this.repository.findProductMedia(productId);
  }

  async deleteProductMedia(productId: number, mediaId: number, actorId: number) {
    const fileId = await this.repository.detachMedia(productId, mediaId);
    if (fileId === null) throw new NotFoundException('Image not found on this product');

    await this.files.deleteIfOrphaned(fileId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.SOFT_DELETE,
      entityType: 'Product',
      entityId: String(productId),
      oldValues: { mediaId },
    });
    this.revalidation.revalidateProduct(await this.repository.findProductCategorySlug(productId));
    return this.repository.findProductMedia(productId);
  }

  // ── Variants ──────────────────────────────────────────────────────────

  async createVariant(
    data: Parameters<AdminCatalogueRepository['createVariant']>[0],
    actorId: number,
  ) {
    const variant = await this.repository.createVariant(data);
    await this.repository.recomputeProduct(data.productId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'ProductVariant',
      entityId: String(variant.id),
      newValues: { sku: variant.sku, partNumber: variant.partNumber },
    });
    return variant;
  }

  async updateVariant(
    id: number,
    productId: number,
    data: Record<string, unknown>,
    actorId: number,
  ) {
    const { attributes, ...rest } = data as { attributes?: Record<string, string> } & Record<
      string,
      unknown
    >;
    const variant = await this.repository.updateVariant(id, rest as never);
    if (attributes) await this.repository.writeVariantAttributes(id, attributes);
    await this.repository.recomputeProduct(productId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'ProductVariant',
      entityId: String(id),
      newValues: rest,
    });
    return variant;
  }

  async deleteVariant(id: number, productId: number, actorId: number) {
    const variant = await this.repository.softDeleteVariant(id);
    // A product with variants must always have a default — promote the next
    // one so the storefront's selector still has something to preselect.
    if (variant.isDefault) await this.repository.promoteNextDefaultVariant(productId);
    await this.repository.recomputeProduct(productId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.SOFT_DELETE,
      entityType: 'ProductVariant',
      entityId: String(id),
      oldValues: { sku: variant.sku, variantName: variant.variantName },
    });
    return variant;
  }



  // ── Compatibility ─────────────────────────────────────────────────────

  async createCompatibility(
    data: Parameters<AdminCatalogueRepository['createCompatibility']>[0],
    actorId: number,
  ) {
    const row = await this.repository.createCompatibility({ ...data, verifiedById: actorId });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'ProductCompatibility',
      entityId: String(row.id),
      newValues: {
        productId: data.productId,
        machineModelId: data.machineModelId,
        isVerified: data.isVerified,
      },
    });
    return row;
  }

  async verifyCompatibility(id: number, actorId: number) {
    const row = await this.repository.verifyCompatibility(id, actorId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'ProductCompatibility',
      entityId: String(id),
      newValues: { isVerified: true },
    });
    return row;
  }

  async deleteCompatibility(id: number, actorId: number) {
    await this.repository.deleteCompatibility(id);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.SOFT_DELETE,
      entityType: 'ProductCompatibility',
      entityId: String(id),
    });
  }

  // ── Machines ──────────────────────────────────────────────────────────

  listMachineBrands(kind?: ComponentKind) {
    return this.repository.listMachineBrands(kind);
  }

  createMachineBrand(name: string, kind: ComponentKind = 'MACHINE') {
    return this.repository.createMachineBrand(name, kind);
  }

  createMachineModel(machineBrandId: number, name: string) {
    return this.repository.createMachineModel(machineBrandId, name);
  }

  createMachineVariant(
    machineModelId: number,
    name: string,
    laserType?: string,
    powerWatts?: number,
  ) {
    return this.repository.createMachineVariant(machineModelId, name, laserType, powerWatts);
  }

  // ── Attributes ────────────────────────────────────────────────────────

  listAttributes() {
    return this.repository.listAttributes();
  }

  createAttribute(data: Parameters<AdminCatalogueRepository['createAttribute']>[0]) {
    return this.repository.createAttribute(data);
  }
}
