const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // All products with brand, category, variant count
  const products = await p.product.findMany({
    include: {
      partBrand: true,
      category: true,
      _count: { select: { variants: true } },
    },
    orderBy: [{ category: { slug: 'asc' } }, { name: 'asc' }],
  });

  console.log('\n=== PRODUCTS ===');
  products.forEach((r) =>
    console.log(
      `id=${r.id} | brand=${r.partBrand?.name ?? 'none'} | cat=${r.category?.slug} | variants=${r._count.variants} | name=${r.name}`
    )
  );

  // All variants for nozzle-category products
  const nozzleProducts = products.filter(
    (p) => p.category?.slug?.includes('nozzle') || p.category?.slug?.includes('cutting')
  );

  console.log('\n=== NOZZLE PRODUCT VARIANTS ===');
  for (const prod of nozzleProducts) {
    const variants = await p.productVariant.findMany({
      where: { productId: prod.id },
      orderBy: { position: 'asc' },
      include: {
        attributeValues: { include: { attribute: true } },
      },
    });
    console.log(`\n[${prod.partBrand?.name ?? 'no brand'}] ${prod.name} (${variants.length} variants):`);
    variants.forEach((v) => {
      const attrs = v.attributeValues
        .map((av) => `${av.attribute.slug}=${av.value}`)
        .join(', ');
      console.log(`  SKU=${v.sku} | variant_name=${v.variantName} | ${attrs}`);
    });
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
