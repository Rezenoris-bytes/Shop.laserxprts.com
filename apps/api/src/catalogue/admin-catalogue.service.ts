import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type AdminListQuery } from '@lei/shared';
import { AuditService } from '../audit/audit.service';
import { AdminCatalogueRepository } from './admin-catalogue.repository';

@Injectable()
export class AdminCatalogueService {
  constructor(
    private readonly repository: AdminCatalogueRepository,
    private readonly audit: AuditService,
  ) {}

  // ── Categories ────────────────────────────────────────────────────────

  listCategories() {
    return this.repository.listCategories();
  }

  async createCategory(data: Parameters<AdminCatalogueRepository['createCategory']>[0], actorId: number) {
    const category = await this.repository.createCategory(data);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Category',
      entityId: String(category.id),
      newValues: { name: category.name, slug: category.slug, isActive: category.isActive },
    });
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
    return category;
  }

  // ── Part brands ───────────────────────────────────────────────────────

  listPartBrands() {
    return this.repository.listPartBrands();
  }

  async createPartBrand(data: Parameters<AdminCatalogueRepository['createPartBrand']>[0], actorId: number) {
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

  async createProduct(data: Parameters<AdminCatalogueRepository['createProduct']>[0], actorId: number) {
    const product = await this.repository.createProduct(data);
    await this.repository.recomputeCategoryCounts();
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Product',
      entityId: String(product.id),
      newValues: { name: product.name, slug: product.slug, categoryId: product.categoryId },
    });
    return product;
  }

  async updateProduct(id: number, data: Record<string, unknown>, actorId: number) {
    const before = await this.repository.findProduct(id);
    if (!before) throw new NotFoundException('Product not found');

    const product = await this.repository.updateProduct(id, data as never);
    await this.repository.recomputeCategoryCounts();

    const diff = this.audit.diff(
      { name: before.name, isActive: before.isActive, categoryId: before.categoryId, hsnCode: before.hsnCode, gstRate: before.gstRate },
      { name: product.name, isActive: product.isActive, categoryId: product.categoryId, hsnCode: product.hsnCode, gstRate: product.gstRate },
    );
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: String(id),
      oldValues: diff.oldValues,
      newValues: diff.newValues,
    });
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
    return product;
  }

  // ── Variants ──────────────────────────────────────────────────────────

  async createVariant(data: Parameters<AdminCatalogueRepository['createVariant']>[0], actorId: number) {
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

  async updateVariant(id: number, productId: number, data: Record<string, unknown>, actorId: number) {
    const { attributes, ...rest } = data as { attributes?: Record<string, string> } & Record<string, unknown>;
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

  // ── Inventory ─────────────────────────────────────────────────────────

  async updateInventory(
    variantId: number,
    productId: number,
    data: { quantity: number; reorderLevel?: number; stockStatus?: string; reason: string; notes?: string },
    actorId: number,
  ) {
    const inventory = await this.repository.updateInventory(variantId, { ...data, performedById: actorId });
    await this.repository.recomputeProduct(productId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.STOCK_ADJUST,
      entityType: 'Inventory',
      entityId: String(variantId),
      newValues: { quantity: data.quantity, reason: data.reason },
    });
    return inventory;
  }

  stockMovements(variantId: number) {
    return this.repository.stockMovements(variantId);
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
      newValues: { productId: data.productId, machineModelId: data.machineModelId, isVerified: data.isVerified },
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

  listMachineBrands() {
    return this.repository.listMachineBrands();
  }

  createMachineBrand(name: string) {
    return this.repository.createMachineBrand(name);
  }

  createMachineModel(machineBrandId: number, name: string) {
    return this.repository.createMachineModel(machineBrandId, name);
  }

  createMachineVariant(machineModelId: number, name: string, laserType?: string, powerWatts?: number) {
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
