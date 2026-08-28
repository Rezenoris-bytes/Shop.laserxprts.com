import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Validated compatibility import.
 *
 * The single rule this service exists to enforce: **a compatibility row is only
 * created when a human has asserted, in writing, that it was verified against a
 * real source.** Wrong fitment is worse than missing fitment — it produces a
 * confident wrong answer, a wrongly-ordered part, and a customer who stops
 * trusting every other answer on the site.
 *
 * So the spreadsheet carries two mandatory evidence columns (`verified` and
 * `source`), and a row missing either is REJECTED rather than imported as
 * unverified. There is deliberately no "import anyway" flag: an unverified row
 * has no consumer, because every public query filters on isVerified.
 *
 * Everything is matched by human-readable name, never by database id, because
 * whoever fills this in is reading a manufacturer's document, not the database.
 */

/** One parsed spreadsheet row, before it is resolved against the database. */
interface CompatRow {
  rowNumber: number;
  componentKind: string;
  componentBrand: string;
  componentModel: string;
  productSlugOrName: string;
  variantName?: string;
  notes?: string;
  verified: string;
  source: string;
}

export interface CompatibilityImportResult {
  dryRun: boolean;
  rowsRead: number;
  created: number;
  alreadyPresent: number;
  rejected: Array<{ row: number; reason: string }>;
}

const KIND_ALIASES = new Map<string, string>([
  ['machine', 'MACHINE'],
  ['cutting head', 'CUTTING_HEAD'],
  ['cutting_head', 'CUTTING_HEAD'],
  ['cuttinghead', 'CUTTING_HEAD'],
  ['head', 'CUTTING_HEAD'],
  ['laser source', 'LASER_SOURCE'],
  ['laser_source', 'LASER_SOURCE'],
  ['source', 'LASER_SOURCE'],
  ['chiller', 'CHILLER'],
  ['controller', 'CONTROLLER'],
  ['servo', 'SERVO'],
]);

const HEADERS = [
  'component_kind',
  'component_brand',
  'component_model',
  'product',
  'variant',
  'notes',
  'verified',
  'source',
];

const truthy = (value: string) => ['yes', 'y', 'true', '1', 'verified'].includes(value.trim().toLowerCase());

const norm = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

@Injectable()
export class CompatibilityImportService {
  private readonly logger = new Logger(CompatibilityImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The blank workbook, with the rules written into the sheet itself.
   *
   * The instructions live in the file rather than in a wiki because the person
   * filling this in six months from now will have the file and not the wiki.
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LEI Platform';

    const sheet = workbook.addWorksheet('Compatibility');
    sheet.columns = [
      { header: 'component_kind', key: 'component_kind', width: 18 },
      { header: 'component_brand', key: 'component_brand', width: 22 },
      { header: 'component_model', key: 'component_model', width: 22 },
      { header: 'product', key: 'product', width: 46 },
      { header: 'variant', key: 'variant', width: 20 },
      { header: 'notes', key: 'notes', width: 34 },
      { header: 'verified', key: 'verified', width: 12 },
      { header: 'source', key: 'source', width: 44 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5B301' },
    };
    sheet.autoFilter = { from: 'A1', to: 'H1' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Restrict the two columns whose values must be exact.
    for (let row = 2; row <= 500; row += 1) {
      sheet.getCell(`A${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"MACHINE,CUTTING_HEAD,LASER_SOURCE,CHILLER,CONTROLLER,SERVO"'],
      };
      sheet.getCell(`G${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"YES"'],
      };
    }

    const guide = workbook.addWorksheet('How to use');
    guide.columns = [{ width: 110 }];
    const lines = [
      'LEI — Compatibility Import',
      '',
      'One row = "this product fits this component model".',
      '',
      'RULES',
      '  1. Only enter fitment you have VERIFIED against a real document.',
      '  2. verified must be YES. Rows without it are rejected, not imported.',
      '  3. source is mandatory. Name the document, page or person, e.g.',
      '     "RayTools BM111 manual p.24" or "Confirmed by LEI service, 12 Mar".',
      '  4. Never enter fitment because two parts look alike, share a brand, or',
      '     have similar model numbers. A wrong fit costs more than a blank.',
      '',
      'COLUMNS',
      '  component_kind   MACHINE / CUTTING_HEAD / LASER_SOURCE / CHILLER / CONTROLLER / SERVO',
      '  component_brand  Must already exist for that kind, e.g. RayTools',
      '  component_model  Must already exist under that brand, e.g. BM111',
      '  product          The product name or its slug, exactly as in the catalogue',
      '  variant          OPTIONAL. Blank = fits every variant of the product.',
      '                   Fill it only when SOME variants fit and others do not.',
      '  notes            Optional, shown to staff (not the public)',
      '  verified         YES',
      '  source           Where the fitment was confirmed',
      '',
      'NOTES',
      '  - Re-importing the same row is safe; duplicates are skipped, not doubled.',
      '  - A brand or model that does not exist yet is reported as a rejection.',
      '    Create it first rather than letting the import invent it.',
    ];
    lines.forEach((line, index) => {
      const cell = guide.getCell(`A${index + 1}`);
      cell.value = line;
      if (index === 0) cell.font = { bold: true, size: 14 };
      if (['RULES', 'COLUMNS', 'NOTES'].includes(line)) cell.font = { bold: true };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Parses and imports a workbook.
   *
   * `dryRun` reports exactly what would happen without writing, which is how
   * this should always be run first on a file somebody else prepared.
   */
  async importFile(
    buffer: Buffer,
    filename: string,
    actorId: number,
    dryRun = false,
  ): Promise<CompatibilityImportResult> {
    if (!/\.xlsx$/i.test(filename)) {
      throw new BadRequestException('Upload a .xlsx file');
    }

    const rows = await this.parse(buffer);
    const result: CompatibilityImportResult = {
      dryRun,
      rowsRead: rows.length,
      created: 0,
      alreadyPresent: 0,
      rejected: [],
    };

    for (const row of rows) {
      const resolved = await this.resolve(row);
      if ('reason' in resolved) {
        result.rejected.push({ row: row.rowNumber, reason: resolved.reason });
        continue;
      }

      const existing = await this.prisma.client.productCompatibility.findFirst({
        where: {
          productId: resolved.productId,
          variantId: resolved.variantId,
          machineModelId: resolved.modelId,
        },
        select: { id: true },
      });
      if (existing) {
        result.alreadyPresent += 1;
        continue;
      }

      if (!dryRun) {
        await this.prisma.client.productCompatibility.create({
          data: {
            productId: resolved.productId,
            variantId: resolved.variantId,
            machineBrandId: resolved.brandId,
            machineModelId: resolved.modelId,
            // Source is preserved in notes: months later, "who says this fits?"
            // is the question that matters, and it must survive in the row.
            notes: [row.notes, `Source: ${row.source}`].filter(Boolean).join(' — ').slice(0, 500),
            isVerified: true,
            verifiedById: actorId,
            verifiedAt: new Date(),
          },
        });
      }
      result.created += 1;
    }

    this.logger.log(
      `Compatibility import${dryRun ? ' (dry run)' : ''}: ${result.created} created, ` +
        `${result.alreadyPresent} already present, ${result.rejected.length} rejected`,
    );
    return result;
  }

  private async parse(buffer: Buffer): Promise<CompatRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    // Find the sheet that actually carries the headers, rather than assuming
    // sheet 0 — an exported file often leads with a summary tab.
    let sheet: ExcelJS.Worksheet | undefined;
    for (const candidate of workbook.worksheets) {
      const header = candidate.getRow(1).values;
      const cells = Array.isArray(header) ? header.map((value) => key(norm(value))) : [];
      if (cells.includes('componentkind') && cells.includes('product')) {
        sheet = candidate;
        break;
      }
    }
    if (!sheet) {
      throw new BadRequestException(
        `No sheet with the expected headers was found. Expected: ${HEADERS.join(', ')}`,
      );
    }

    const headerRow = sheet.getRow(1).values as unknown[];
    const index = new Map<string, number>();
    headerRow.forEach((value, position) => {
      const name = key(norm(value));
      if (name) index.set(name, position);
    });

    const read = (row: ExcelJS.Row, name: string) => {
      const position = index.get(name);
      if (!position) return '';
      const cell = row.getCell(position).value;
      if (cell && typeof cell === 'object' && 'text' in cell) return norm((cell as { text: string }).text);
      return norm(cell);
    };

    const rows: CompatRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const parsed: CompatRow = {
        rowNumber,
        componentKind: read(row, 'componentkind'),
        componentBrand: read(row, 'componentbrand'),
        componentModel: read(row, 'componentmodel'),
        productSlugOrName: read(row, 'product'),
        variantName: read(row, 'variant') || undefined,
        notes: read(row, 'notes') || undefined,
        verified: read(row, 'verified'),
        source: read(row, 'source'),
      };
      // Skip rows that are entirely blank — Excel materialises empty rows below
      // the data whenever data validation has been applied to a range.
      const hasContent =
        parsed.componentKind || parsed.componentBrand || parsed.componentModel || parsed.productSlugOrName;
      if (hasContent) rows.push(parsed);
    });

    return rows;
  }

  /** Resolves one row to ids, or explains precisely why it cannot be imported. */
  private async resolve(
    row: CompatRow,
  ): Promise<{ productId: number; variantId: number | null; brandId: number; modelId: number } | { reason: string }> {
    // --- evidence gate, before anything is looked up ---------------------
    if (!truthy(row.verified)) {
      return { reason: 'verified is not YES — unverified fitment is never imported' };
    }
    if (!row.source) {
      return { reason: 'source is empty — every verified row must say where it was confirmed' };
    }

    const kind = KIND_ALIASES.get(row.componentKind.toLowerCase()) ?? row.componentKind.toUpperCase();
    if (!['MACHINE', 'CUTTING_HEAD', 'LASER_SOURCE', 'CHILLER', 'CONTROLLER', 'SERVO'].includes(kind)) {
      return { reason: `unknown component_kind "${row.componentKind}"` };
    }

    // --- component brand + model, scoped by kind -------------------------
    const brands = await this.prisma.client.machineBrand.findMany({
      where: { kind: kind as never, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    const brand = brands.find(
      (candidate) => key(candidate.name) === key(row.componentBrand) || key(candidate.slug) === key(row.componentBrand),
    );
    if (!brand) {
      return { reason: `no ${kind} brand named "${row.componentBrand}" — create it before importing` };
    }

    const models = await this.prisma.client.machineModel.findMany({
      where: { machineBrandId: brand.id, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    const model = models.find(
      (candidate) => key(candidate.name) === key(row.componentModel) || key(candidate.slug) === key(row.componentModel),
    );
    if (!model) {
      return { reason: `${brand.name} has no model "${row.componentModel}" — create it before importing` };
    }

    // --- product ---------------------------------------------------------
    const product = await this.prisma.client.product.findFirst({
      where: {
        deletedAt: null,
        OR: [{ slug: row.productSlugOrName }, { name: row.productSlugOrName }],
      },
      select: { id: true, name: true },
    });
    if (!product) {
      return { reason: `no product matches "${row.productSlugOrName}"` };
    }

    // --- optional variant ------------------------------------------------
    let variantId: number | null = null;
    if (row.variantName) {
      const variant = await this.prisma.client.productVariant.findFirst({
        where: { productId: product.id, deletedAt: null, variantName: row.variantName },
        select: { id: true },
      });
      if (!variant) {
        return { reason: `"${product.name}" has no variant named "${row.variantName}"` };
      }
      variantId = variant.id;
    }

    return { productId: product.id, variantId, brandId: brand.id, modelId: model.id };
  }
}
