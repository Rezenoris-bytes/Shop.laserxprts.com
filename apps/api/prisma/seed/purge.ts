/* eslint-disable no-console */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

/**
 * Removes every row flagged `is_seed_data = true`.
 *
 * This is the mechanism that makes swapping demo data for the real LEI
 * catalogue safe: one flag, one transaction, no orphans, and no guessing which
 * rows were fake. The boot-time production check refuses to start with
 * DEMO_MODE=false while any of these remain, so the purge cannot be forgotten.
 *
 * Deletion runs child-first, because the foreign keys are Restrict by design —
 * a catalogue item referenced by a historical quote must never vanish.
 *
 *   npm run db:purge-seed          report only
 *   npm run db:purge-seed -- --yes actually delete
 */
async function main(): Promise<void> {
  const confirmed = process.argv.includes('--yes');

  console.log('\nSeed data purge' + (confirmed ? '' : '  (DRY RUN — pass --yes to apply)'));
  console.log('='.repeat(60));

  const seed = { isSeedData: true } as const;

  const counts = {
    compatibility: await prisma.productCompatibility.count({ where: seed }),
    quotes: await prisma.quote.count({ where: seed }),
    enquiries: await prisma.enquiry.count({ where: seed }),
    customers: await prisma.customer.count({ where: seed }),
    variants: await prisma.productVariant.count({ where: seed }),
    products: await prisma.product.count({ where: seed }),
    categories: await prisma.category.count({ where: seed }),
    partBrands: await prisma.partBrand.count({ where: seed }),
    machineVariants: await prisma.machineVariant.count({ where: seed }),
    machineModels: await prisma.machineModel.count({ where: seed }),
    machineBrands: await prisma.machineBrand.count({ where: seed }),
    attributes: await prisma.attribute.count({ where: seed }),
  };

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${table.padEnd(20)} ${count}`);
  }

  if (total === 0) {
    console.log('  nothing to purge — no seed data present.\n');
    return;
  }

  console.log(`  ${'TOTAL'.padEnd(20)} ${total}`);

  if (!confirmed) {
    console.log('\nDry run. Re-run with --yes to delete.\n');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Children first, so Restrict foreign keys never block the parent delete.
    const seedProducts = await tx.product.findMany({ where: seed, select: { id: true } });
    const productIds = seedProducts.map((p) => p.id);

    const seedVariants = await tx.productVariant.findMany({ where: seed, select: { id: true } });
    const variantIds = seedVariants.map((v) => v.id);

    await tx.productCompatibility.deleteMany({ where: seed });
    await tx.attributeValue.deleteMany({
      where: { OR: [{ productId: { in: productIds } }, { variantId: { in: variantIds } }] },
    });
    await tx.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.enquiryItem.deleteMany({ where: { variantId: { in: variantIds } } });

    const seedEnquiries = await tx.enquiry.findMany({ where: seed, select: { id: true } });
    const enquiryIds = seedEnquiries.map((e) => e.id);
    await tx.enquiryAttachment.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await tx.enquiryItem.deleteMany({ where: { enquiryId: { in: enquiryIds } } });

    const seedQuotes = await tx.quote.findMany({ where: seed, select: { id: true } });
    const quoteIds = seedQuotes.map((q) => q.id);
    const revisions = await tx.quoteRevision.findMany({
      where: { quoteId: { in: quoteIds } },
      select: { id: true },
    });
    await tx.quoteRevisionItem.deleteMany({
      where: { quoteRevisionId: { in: revisions.map((r) => r.id) } },
    });
    // Break the circular FK before deleting the revisions.
    await tx.quote.updateMany({
      where: { id: { in: quoteIds } },
      data: { currentRevisionId: null, acceptedRevisionId: null },
    });
    await tx.quoteRevision.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await tx.quote.deleteMany({ where: seed });

    await tx.lead.deleteMany({ where: seed });
    await tx.enquiry.deleteMany({ where: seed });
    await tx.productMedia.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productVariant.deleteMany({ where: seed });
    await tx.product.deleteMany({ where: seed });
    await tx.customerAddress.deleteMany({
      where: { customer: { isSeedData: true } },
    });
    await tx.customer.deleteMany({ where: seed });
    await tx.category.deleteMany({ where: { ...seed, parentId: { not: null } } });
    await tx.category.deleteMany({ where: seed });
    await tx.partBrand.deleteMany({ where: seed });
    await tx.machineVariant.deleteMany({ where: seed });
    await tx.machineModel.deleteMany({ where: seed });
    await tx.machineBrand.deleteMany({ where: seed });
    await tx.attribute.deleteMany({ where: seed });
  });

  console.log('\n  Purge complete.');
  console.log('  Remember to replace PLACEHOLDER settings before setting DEMO_MODE=false.\n');
}

main()
  .catch((error) => {
    console.error('\nPurge failed:\n', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
