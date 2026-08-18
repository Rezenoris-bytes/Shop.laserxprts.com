import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SeedDataCensus {
  categories: number;
  partBrands: number;
  products: number;
  productVariants: number;
  machineBrands: number;
  machineModels: number;
  machineVariants: number;
  compatibility: number;
  customers: number;
  enquiries: number;
  quotes: number;
  attributes: number;
}

/**
 * Reads the seed-data and placeholder-setting state.
 *
 * Kept as a repository (rather than PrismaService inside the service) so the
 * "only *.repository.ts touches Prisma" rule holds for our own infrastructure
 * code too — a rule that gets waived once stops being a rule.
 */
@Injectable()
export class DemoModeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts every row flagged as seed data, by table. */
  async censusSeedData(): Promise<SeedDataCensus> {
    const db = this.prisma.raw;
    const seed = { isSeedData: true } as const;

    const [
      categories,
      partBrands,
      products,
      productVariants,
      machineBrands,
      machineModels,
      machineVariants,
      compatibility,
      customers,
      enquiries,
      quotes,
      attributes,
    ] = await Promise.all([
      db.category.count({ where: seed }),
      db.partBrand.count({ where: seed }),
      db.product.count({ where: seed }),
      db.productVariant.count({ where: seed }),
      db.machineBrand.count({ where: seed }),
      db.machineModel.count({ where: seed }),
      db.machineVariant.count({ where: seed }),
      db.productCompatibility.count({ where: seed }),
      db.customer.count({ where: seed }),
      db.enquiry.count({ where: seed }),
      db.quote.count({ where: seed }),
      db.attribute.count({ where: seed }),
    ]);

    return {
      categories,
      partBrands,
      products,
      productVariants,
      machineBrands,
      machineModels,
      machineVariants,
      compatibility,
      customers,
      enquiries,
      quotes,
      attributes,
    };
  }

  /** Settings still holding a PLACEHOLDER value (company details, HSN, etc.). */
  async findPlaceholderSettings(): Promise<string[]> {
    const rows = await this.prisma.raw.setting.findMany({
      where: { value: { contains: 'PLACEHOLDER' } },
      select: { key: true },
    });
    return rows.map((row) => row.key);
  }
}
