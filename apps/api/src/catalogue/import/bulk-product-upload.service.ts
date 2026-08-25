import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { slugify, type ProductType } from '@lei/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { AdminCatalogueRepository } from '../admin-catalogue.repository';
import { parseCsv } from './csv-parser';

export interface BulkUploadError {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  created: number;
  updated: number;
  imagesAttached: number;
  categoriesCreated: number;
  brandsCreated: number;
  errors: BulkUploadError[];
}

const PRODUCT_TYPES = new Set<ProductType>([
  'SPARE_PART',
  'CONSUMABLE',
  'COMPONENT',
  'ACCESSORY',
  'KIT',
]);

const TEMPLATE_HEADERS = [
  'name',
  'category',
  'brand',
  'type',
  'variant',
  'sku',
  'price',
  'short_description',
  'description',
  'image',
];

interface BulkRow {
  line: number;
  values: Record<string, string>;
  imageBuffer: Buffer | null;
}

// ── Spreadsheet presentation ────────────────────────────────────────────────
// The header names are the contract the importer reads, so they stay
// lower_snake_case; only widths, colour and validation are cosmetic.

const COLUMN_WIDTHS: Record<string, number> = {
  name: 40,
  category: 26,
  brand: 18,
  type: 16,
  variant: 16,
  sku: 30,
  price: 12,
  short_description: 44,
  description: 52,
  image: 20,
};

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
};

function styleHeaderRow(row: ExcelJS.Row): void {
  row.height = 26;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.eachCell((cell) => {
    cell.border = THIN_BORDER;
  });
}

/**
 * Column-level formatting that must hold for rows the owner has not typed yet:
 * a dropdown on `type` and a currency format on `price`.
 *
 * `lastRow` is kept modest on purpose — every row touched here is materialised
 * in the file, so a large buffer pads the sheet with empty rows and sends
 * Ctrl+End into blank space.
 */
function applySheetFormatting(sheet: ExcelJS.Worksheet, headers: string[], lastRow = 120): void {
  const columnOf = (name: string) => headers.indexOf(name) + 1;

  const typeCol = columnOf('type');
  const priceCol = columnOf('price');
  const imageCol = columnOf('image');

  for (let r = 2; r <= lastRow; r += 1) {
    if (typeCol > 0) {
      sheet.getCell(r, typeCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"SPARE_PART,CONSUMABLE,COMPONENT,ACCESSORY,KIT"'],
        showErrorMessage: true,
        errorTitle: 'Not a valid type',
        error: 'Choose one of SPARE_PART, CONSUMABLE, COMPONENT, ACCESSORY, KIT — or leave blank.',
      };
    }
    if (priceCol > 0) {
      sheet.getCell(r, priceCol).numFmt = '#,##0.00';
      sheet.getCell(r, priceCol).alignment = { horizontal: 'right', vertical: 'middle' };
    }
  }

  if (imageCol > 0) sheet.getColumn(imageCol).alignment = { vertical: 'middle' };
}

/**
 * Bulk product upload — the simple, single-file alternative to the technical
 * 3-file CSV importer (catalogue-import.service.ts).
 *
 * One row = one variant. Rows sharing the same `name` (case-insensitive,
 * trimmed) become variants of ONE product — that's how a nozzle with H15/H20/
 * H25 thread options is expressed: three rows, same name, different `variant`
 * label and `sku`. A name seen for the first time creates a new product; a
 * name that already exists (in this file or already in the catalogue) adds
 * another variant to it instead of duplicating the product.
 *
 * Categories and brands are matched by NAME (not slug) because that is what a
 * shop owner actually has on hand — asking for a slug here would just move
 * the friction, not remove it. An embedded image in the `image` column
 * (Excel only) is attached to the product's gallery.
 */
@Injectable()
export class BulkProductUploadService {
  private readonly logger = new Logger(BulkProductUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: AdminCatalogueRepository,
    private readonly files: FilesService,
  ) {}

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Laser Experts India';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = TEMPLATE_HEADERS.map((header) => ({
      header,
      key: header,
      width: COLUMN_WIDTHS[header] ?? 18,
    }));

    styleHeaderRow(sheet.getRow(1));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TEMPLATE_HEADERS.length } };

    const example = {
      name: 'Raytools Single Layer Nozzle',
      category: 'Single Layer Nozzles',
      brand: 'Raytools',
      type: 'CONSUMABLE',
      short_description: 'Single layer copper cutting nozzle for Raytools BM-series heads.',
      description: 'Precision-machined single layer nozzle for Raytools BM-series cutting heads.',
    };
    sheet.addRow({ ...example, variant: 'H15', sku: 'RT-BM110-SL-H15', price: 890, image: '' });
    sheet.addRow({ ...example, variant: 'H20', sku: 'RT-BM110-SL-H20', price: 890, image: '' });
    sheet.addRow({ ...example, variant: 'H25', sku: 'RT-BM110-SL-H25', price: 950, image: '' });

    // The three filled rows are examples, not data — tint them so nobody
    // mistakes them for real stock and uploads them by accident.
    for (let r = 2; r <= 4; r += 1) {
      const row = sheet.getRow(r);
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { italic: true, color: { argb: 'FF6B7280' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    applySheetFormatting(sheet, TEMPLATE_HEADERS);

    const help = workbook.addWorksheet('Instructions');
    help.columns = [{ width: 92 }];
    [
      'How to use this template',
      '',
      'Delete the three grey example rows before uploading your own stock.',
      '',
      '1. One row = one variant (one SKU). Rows with the SAME "name" become variants of',
      '   ONE product — see the 3 example rows: same name, different "variant" (H15/H20/',
      '   H25) and "sku". A name you have not used before creates a new product.',
      '2. Only the FIRST row for a product needs "category"/"brand"/"type"/descriptions —',
      '   later rows for the same product can leave those blank and just fill "variant",',
      '   "sku" and "price". Filling them again on a later row updates the product too.',
      '3. "category" and "brand" are matched by name (case-insensitive). If the name does not',
      '   already exist in the admin panel, it is created automatically — check spelling',
      '   carefully, since a typo creates a new category instead of using the right one.',
      '4. "type" is one of: SPARE_PART, CONSUMABLE, COMPONENT, ACCESSORY, KIT.',
      '   Leave blank for SPARE_PART.',
      '5. "variant" is the label shown to customers (H15, 1.5mm, Red, etc.). Leave blank',
      '   for a single-variant product — it will just be called "Standard".',
      '6. "sku" must be unique per variant. Re-uploading the same sku updates that variant',
      '   instead of creating a duplicate.',
      '7. "price" is optional — leave blank for "price on request".',
      '8. To attach a photo, insert an image directly into the "image" cell for that row',
      '   (Insert > Picture in Excel, then resize it to sit inside the cell). This only',
      '   works in .xlsx files — plain CSV uploads cannot carry images. Each row\'s photo',
      '   is added to the product\'s gallery.',
      '9. The URL/slug is generated automatically from the product name — you do not',
      '   need to type one.',
    ].forEach((line) => help.addRow([line]));

    help.getRow(1).font = { bold: true, size: 14 };
    help.eachRow((row) => {
      row.alignment = { vertical: 'top' };
      row.height = 16;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importFile(
    buffer: Buffer,
    filename: string,
    actorId: number,
  ): Promise<BulkUploadResult> {
    const isExcel = /\.xlsx$/i.test(filename);
    const rows = isExcel ? await this.readExcelRows(buffer) : await this.readCsvRows(buffer);

    const result: BulkUploadResult = {
      created: 0,
      updated: 0,
      imagesAttached: 0,
      categoriesCreated: 0,
      brandsCreated: 0,
      errors: [],
    };
    if (rows.length === 0) {
      result.errors.push({ row: 1, message: 'No data rows found in the file.' });
      return result;
    }

    const [categories, brands, existingProducts] = await Promise.all([
      this.repository.listCategories(),
      this.repository.listPartBrands(),
      this.prisma.client.product.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    const brandByName = new Map(brands.map((b) => [b.name.trim().toLowerCase(), b]));
    // Seeded from the existing catalogue, then grown as rows create new
    // products, so a later row with the same name (in this file OR already
    // in the catalogue) adds a variant instead of duplicating the product.
    const productIdByName = new Map(
      existingProducts.map((p) => [p.name.trim().toLowerCase(), p.id]),
    );

    for (const row of rows) {
      try {
        const name = row.values.name?.trim();
        if (!name) throw new Error('"name" is required');
        const normalizedName = name.toLowerCase();

        const sku = row.values.sku?.trim();
        if (!sku) throw new Error('"sku" is required');

        const price = row.values.price?.trim() ? Number(row.values.price) : null;
        if (price !== null && !Number.isFinite(price)) throw new Error('"price" is not a number');

        const variantLabel = row.values.variant?.trim() || 'Standard';

        const existingVariant = await this.prisma.client.productVariant.findFirst({
          where: { sku },
          select: { id: true, productId: true },
        });

        let productId: number;

        if (existingVariant) {
          // This SKU already exists — update its product and its own fields.
          await this.updateProductFromRow(existingVariant.productId, row, categoryByName, brandByName, result);
          await this.repository.updateVariant(existingVariant.id, {
            variantName: variantLabel,
            price,
            priceType: (price === null ? 'ON_REQUEST' : 'FIXED') as never,
          });
          productId = existingVariant.productId;
          result.updated += 1;
        } else if (productIdByName.has(normalizedName)) {
          // A new SKU joining a product that already exists (this file or the
          // catalogue) — just add the variant, no new product.
          productId = productIdByName.get(normalizedName)!;
          await this.updateProductFromRow(productId, row, categoryByName, brandByName, result);
          const position = await this.prisma.client.productVariant.count({ where: { productId } });
          await this.repository.createVariant({
            productId,
            sku,
            partNumber: sku,
            variantName: variantLabel,
            price,
            priceType: price === null ? 'ON_REQUEST' : 'FIXED',
            unitOfMeasure: 'PIECE',
            packSize: 1,
            minOrderQty: 1,
            isDefault: position === 0,
            position,
            isActive: true,
          });
          result.updated += 1;
        } else {
          // Genuinely new product — first row for this name.
          const categoryName = row.values.category?.trim();
          if (!categoryName) throw new Error('"category" is required');
          const category = await this.resolveOrCreateCategory(categoryName, categoryByName, result);

          const brandName = row.values.brand?.trim();
          const brand = brandName
            ? await this.resolveOrCreateBrand(brandName, brandByName, result)
            : undefined;
          const typeRaw = row.values.type?.trim().toUpperCase();
          const productType: ProductType =
            typeRaw && PRODUCT_TYPES.has(typeRaw as ProductType)
              ? (typeRaw as ProductType)
              : 'SPARE_PART';

          const product = await this.repository.createProduct({
            categoryId: category.id,
            partBrandId: brand?.id ?? null,
            name,
            slug: slugify(name),
            productType,
            shortDescription: row.values.short_description?.trim() || undefined,
            description: row.values.description?.trim() || undefined,
            isFeatured: false,
            isActive: true,
          });
          await this.repository.createVariant({
            productId: product.id,
            sku,
            partNumber: sku,
            variantName: variantLabel,
            price,
            priceType: price === null ? 'ON_REQUEST' : 'FIXED',
            unitOfMeasure: 'PIECE',
            packSize: 1,
            minOrderQty: 1,
            isDefault: true,
            position: 0,
            isActive: true,
          });
          productId = product.id;
          productIdByName.set(normalizedName, productId);
          result.created += 1;
        }

        if (row.imageBuffer) {
          const stored = await this.files.storeProductImage(
            row.imageBuffer,
            `${slugify(name)}-${variantLabel}.jpg`,
            actorId,
          );
          await this.repository.attachMedia(productId, stored.id, `${name} — ${variantLabel}`);
          result.imagesAttached += 1;
        }

        await this.repository.recomputeProduct(productId);
      } catch (error) {
        result.errors.push({ row: row.line, message: (error as Error).message });
      }
    }

    await this.repository.recomputeCategoryCounts();
    return result;
  }

  /**
   * Applies a row's product-level fields (name/category/brand/type/
   * description) to an existing product. Used both when a row updates a
   * known SKU and when a row adds a new variant to a product that already
   * exists — in both cases the product-level columns win, so keeping them
   * consistent across a product's variant rows keeps the product's own
   * details in sync with the latest upload.
   */
  private async updateProductFromRow(
    productId: number,
    row: BulkRow,
    categoryByName: Map<string, { id: number }>,
    brandByName: Map<string, { id: number }>,
    result: BulkUploadResult,
  ): Promise<void> {
    const name = row.values.name?.trim();
    const categoryName = row.values.category?.trim();
    const category = categoryName
      ? await this.resolveOrCreateCategory(categoryName, categoryByName, result)
      : undefined;
    const brandName = row.values.brand?.trim();
    const brand = brandName
      ? await this.resolveOrCreateBrand(brandName, brandByName, result)
      : undefined;
    const typeRaw = row.values.type?.trim().toUpperCase();
    const productType =
      typeRaw && PRODUCT_TYPES.has(typeRaw as ProductType) ? (typeRaw as ProductType) : undefined;

    const shortDescription = row.values.short_description?.trim();
    const description = row.values.description?.trim();

    await this.repository.updateProduct(productId, {
      ...(name ? { name } : {}),
      ...(category ? { categoryId: category.id } : {}),
      ...(brand ? { partBrandId: brand.id } : {}),
      ...(productType ? { productType: productType as never } : {}),
      // Blank on this row means "unchanged", not "clear it" — a variant-only
      // row that only fills sku/price/variant must not wipe out the
      // description the product's first row set.
      ...(shortDescription ? { shortDescription } : {}),
      ...(description ? { description } : {}),
    });
  }

  /** Matches a category by name, creating it (once per upload) if it doesn't exist yet. */
  private async resolveOrCreateCategory(
    name: string,
    categoryByName: Map<string, { id: number }>,
    result: BulkUploadResult,
  ): Promise<{ id: number }> {
    const key = name.toLowerCase();
    const existing = categoryByName.get(key);
    if (existing) return existing;

    const created = await this.repository.createCategory({ name, sortOrder: 0, isActive: true });
    categoryByName.set(key, created);
    result.categoriesCreated += 1;
    return created;
  }

  /** Matches a brand by name, creating it (once per upload) if it doesn't exist yet. */
  private async resolveOrCreateBrand(
    name: string,
    brandByName: Map<string, { id: number }>,
    result: BulkUploadResult,
  ): Promise<{ id: number }> {
    const key = name.toLowerCase();
    const existing = brandByName.get(key);
    if (existing) return existing;

    const created = await this.repository.createPartBrand({ name, isActive: true });
    brandByName.set(key, created);
    result.brandsCreated += 1;
    return created;
  }

  private async readCsvRows(buffer: Buffer): Promise<BulkRow[]> {
    const parsed = parseCsv(buffer.toString('utf-8'));
    return parsed.rows.map((row) => ({ line: row.line, values: row.values, imageBuffer: null }));
  }

  /**
   * Picks the sheet holding the product rows.
   *
   * Not simply the first sheet: a workbook may lead with a summary or cover
   * sheet (the catalogue export does), and reading that yields "name is
   * required" on every row — a baffling error when the data is plainly there.
   * The data sheet is the first one whose header row declares a `name` column.
   */
  private findDataSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
    const hasNameHeader = (sheet: ExcelJS.Worksheet): boolean => {
      let found = false;
      sheet.getRow(1).eachCell((cell) => {
        if (cell.text?.trim().toLowerCase() === 'name') found = true;
      });
      return found;
    };
    return workbook.worksheets.find(hasNameHeader) ?? workbook.worksheets[0];
  }

  private async readExcelRows(buffer: Buffer): Promise<BulkRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = this.findDataSheet(workbook);
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const headerByColumn = new Map<number, string>();
    headerRow.eachCell((cell, colNumber) => {
      const value = cell.text?.trim().toLowerCase();
      if (value) headerByColumn.set(colNumber, value);
    });

    // Anchor each embedded image to the data row it visually sits in.
    const imageByRow = new Map<number, Buffer>();
    for (const image of sheet.getImages()) {
      const rowNumber = Math.round(image.range.tl.row) + 1;
      const media = workbook.getImage(Number(image.imageId));
      if (media?.buffer) {
        imageByRow.set(rowNumber, Buffer.from(media.buffer));
      }
    }

    const rows: BulkRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (row.cellCount === 0) continue;

      const values: Record<string, string> = {};
      let hasContent = false;
      row.eachCell((cell, colNumber) => {
        const header = headerByColumn.get(colNumber);
        if (!header) return;
        const text = cell.text?.trim() ?? '';
        values[header] = text;
        if (text) hasContent = true;
      });

      const imageBuffer = imageByRow.get(rowNumber) ?? null;
      if (!hasContent && !imageBuffer) continue;

      rows.push({ line: rowNumber, values, imageBuffer });
    }

    return rows;
  }
}
