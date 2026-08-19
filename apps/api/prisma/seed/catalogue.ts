/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { CatalogueImportService } from '../../src/catalogue/import/catalogue-import.service';

const CSV_DIR = path.join(__dirname, 'csv');

/**
 * Loads the demo catalogue through the PRODUCTION importer.
 *
 * This is the whole point of the arrangement: the seed exercises the same code
 * path the real LEI catalogue will use, every day of development. An importer
 * written late and run once is an importer that fails on the day it matters.
 *
 * Swapping demo data for the real catalogue is: export into these same seven
 * templates, dry-run, purge `WHERE is_seed_data = true`, apply. No migration,
 * no code change.
 *
 * Import order is a hard dependency chain:
 *   machines -> attributes -> categories -> brands -> products -> variants -> compatibility
 */
export async function seedCatalogueFromCsv(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`  catalogue         skipped (${existing} products already present)`);
    return;
  }

  const importer = new CatalogueImportService();
  importer.resetKeyCache();

  // isSeedData marks every row so the pre-production purge is total and safe,
  // and so the admin UI can chip these records as demo data.
  const options = { dryRun: false, isSeedData: true };

  const steps: Array<[string, string, (content: string) => Promise<unknown>]> = [
    ['machines', '01-machines.csv', (c) => importer.importMachines(prisma, c, options)],
    ['attributes', '02-attributes.csv', (c) => importer.importAttributes(prisma, c, options)],
    ['categories', '03-categories.csv', (c) => importer.importCategories(prisma, c, options)],
    ['part brands', '04-part-brands.csv', (c) => importer.importPartBrands(prisma, c, options)],
    ['products', '05-products.csv', (c) => importer.importProducts(prisma, c, options)],
    ['variants', '06-variants.csv', (c) => importer.importVariants(prisma, c, options)],
    [
      'compatibility',
      '07-compatibility.csv',
      (c) => importer.importCompatibility(prisma, c, options),
    ],
  ];

  let totalErrors = 0;

  for (const [label, file, run] of steps) {
    const filePath = path.join(CSV_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${label.padEnd(17)} SKIPPED — ${file} not found`);
      continue;
    }

    const result = (await run(fs.readFileSync(filePath, 'utf8'))) as {
      created: number;
      updated: number;
      skipped: number;
      errors: Array<{ line: number; message: string }>;
    };

    const summary = `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`;
    console.log(`  ${label.padEnd(17)} ${summary}`);

    // Row-level errors, so a bad CSV can be fixed and re-run rather than
    // leaving the operator with only "import failed".
    for (const error of result.errors.slice(0, 10)) {
      console.log(`      line ${error.line}: ${error.message}`);
    }
    if (result.errors.length > 10) {
      console.log(`      ... and ${result.errors.length - 10} more`);
    }
    totalErrors += result.errors.length;
  }

  console.log('  recomputing       variantAxes, price ranges, stock flags, category counts');
  await importer.recomputeDerived(prisma);

  if (totalErrors > 0) {
    console.log(`\n  WARNING: ${totalErrors} row(s) failed to import.`);
  }
}
