import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enquiryCountsByStatus() {
    return this.prisma.client.enquiry.groupBy({ by: ['status'], _count: { _all: true } });
  }

  async quoteCountsByStatus() {
    return this.prisma.client.quote.groupBy({ by: ['status'], _count: { _all: true } });
  }

  async quotesExpiringSoon() {
    return this.prisma.client.quoteRevision.count({
      where: {
        validUntil: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        quote: { is: { currentRevisionId: { not: null } } },
      },
    });
  }

  async activeProductsCount() {
    return this.prisma.client.product.count({ where: { isActive: true, deletedAt: null } });
  }

  async inactiveProductsCount() {
    return this.prisma.client.product.count({ where: { isActive: false, deletedAt: null } });
  }

  async searchNoResultsRecent(days: number, limit: number) {
    return this.prisma.raw.searchQueryLog.groupBy({
      by: ['normalized'],
      where: {
        resultCount: 0,
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
      orderBy: { _count: { normalized: 'desc' } },
      take: limit,
    });
  }
}
