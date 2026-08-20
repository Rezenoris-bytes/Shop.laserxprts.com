/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { CatalogueImportService } from '../../src/catalogue/import/catalogue-import.service';

loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

const CSV_DIR = path.join(__dirname, '../data/reference');

/**
 * Loads the real reference catalogue through the production importer.
 *
 * Unlike the demo seed this writes `is_seed_data = false`: these are genuine
 * catalogue records, and flagging them as seed data would let `db:purge-seed`
 * delete the entire catalogue.
 *
 * Image BYTES are not touched here — `fetch_images` puts them under
 * STORAGE_ROOT/products and 06-media.csv records where they landed. Keeping the
 * download out of the import means a re-run costs no network traffic.
 *
 *   npm run db:import-reference            dry run, reports only
 *   npm run db:import-reference -- --yes   apply
 */
async function main(): Promise<void> {
  const confirmed = process.argv.includes('--yes');
  const prisma = new PrismaClient();
  const importer = new CatalogueImportService();
  importer.resetKeyCache();

  const options = { dryRun: !confirmed, isSeedData: false };

  // Order is a hard dependency chain: products resolve category and brand
  // slugs, and variants and media resolve product_key against the map the
  // product pass builds.
  const steps: Array<[string, string, (content: string) => Promise<unknown>]> = [
    ['categories', '01-categories.csv', (c) => importer.importCategories(prisma, c, options)],
    ['attributes', '02-attributes.csv', (c) => importer.importAttributes(prisma, c, options)],
    ['part brands', '03-part-brands.csv', (c) => importer.importPartBrands(prisma, c, options)],
    ['products', '04-products.csv', (c) => importer.importProducts(prisma, c, options)],
    ['variants', '05-variants.csv', (c) => importer.importVariants(prisma, c, options)],
    ['media', '06-media.csv', (c) => importer.importMedia(prisma, c, options)],
  ];

  console.log('\nReference catalogue import' + (confirmed ? '' : '  (DRY RUN — pass --yes to apply)'));
  console.log('='.repeat(64));

  let totalErrors = 0;
  try {
    for (const [label, file, run] of steps) {
      const filePath = path.join(CSV_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.log(`  ${label.padEnd(14)} SKIPPED — ${file} not found`);
        continue;
      }

      const result = (await run(fs.readFileSync(filePath, 'utf8'))) as {
        created: number;
        updated: number;
        skipped: number;
        errors: Array<{ line: number; message: string }>;
      };

      console.log(
        `  ${label.padEnd(14)} ${result.created} created, ${result.updated} updated, ` +
          `${result.skipped} skipped, ${result.errors.length} errors`,
      );
      for (const error of result.errors.slice(0, 10)) {
        console.log(`      line ${error.line}: ${error.message}`);
      }
      if (result.errors.length > 10) {
        console.log(`      ... and ${result.errors.length - 10} more`);
      }
      totalErrors += result.errors.length;
    }

    if (confirmed) {
      // productCount drives the category tiles and is denormalised, so it has
      // to be recomputed after a bulk load rather than left at its seed value.
      const categories = await prisma.category.findMany({ select: { id: true } });
      for (const category of categories) {
        const count = await prisma.product.count({
          where: { categoryId: category.id, isActive: true, deletedAt: null },
        });
        await prisma.category.update({ where: { id: category.id }, data: { productCount: count } });
      }
      console.log(`\n  recomputed product counts for ${categories.length} categories`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    totalErrors === 0
      ? `\n  ${confirmed ? 'Import complete.' : 'Dry run clean — re-run with --yes to apply.'}\n`
      : `\n  ${totalErrors} row error(s).\n`,
  );
  if (totalErrors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('\nImport failed:\n', error);
  process.exit(1);
});
