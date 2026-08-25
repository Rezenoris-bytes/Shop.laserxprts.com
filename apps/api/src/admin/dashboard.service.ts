import { Injectable } from '@nestjs/common';
import type { DashboardResponse } from '@lei/shared';
import { DemoModeService } from '../demo/demo-mode.service';
import { SettingsService } from '../settings/settings.service';
import { DashboardRepository } from './dashboard.repository';

/**
 * Dashboard — six fixed tiles, deliberately not a report builder.
 *
 * "Reports" is an unbounded requirement that can absorb infinite build time;
 * the Phase 1 scope is exactly these six, chosen because each maps to an
 * action someone should take today (an unassigned enquiry, a quote about to
 * expire, stock about to run out).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly demo: DemoModeService,
    private readonly settings: SettingsService,
  ) {}

  async get(): Promise<DashboardResponse> {
    const [
      enquiryCounts,
      quoteCounts,
      expiringSoon,
      lowStock,
      outOfStock,
      noResults,
      demoData,
      placeholders,
    ] = await Promise.all([
      this.repository.enquiryCountsByStatus(),
      this.repository.quoteCountsByStatus(),
      this.repository.quotesExpiringSoon(),
      this.repository.activeProductsCount(),
      this.repository.inactiveProductsCount(),
      this.repository.searchNoResultsRecent(7, 10),
      this.demo.census(),
      this.settings.placeholderKeys(),
    ]);

    const byStatus = (rows: Array<{ status: string; _count: { _all: number } }>, key: string) =>
      rows.find((row) => row.status === key)?._count._all ?? 0;

    return {
      enquiries: {
        new: byStatus(enquiryCounts, 'NEW'),
        called: byStatus(enquiryCounts, 'CALLED'),
        confirmed: byStatus(enquiryCounts, 'CONFIRMED'),
        total: enquiryCounts.reduce((sum: number, row: { _count: { _all: number } }) => sum + row._count._all, 0),
      },
      quotes: {
        draft: byStatus(quoteCounts, 'DRAFT'),
        sent: byStatus(quoteCounts, 'SENT'),
        expiringSoon,
      },
      products: { active: lowStock, inactive: outOfStock },
      searchNoResults: noResults.map((row: { normalized: string; _count: { _all: number } }) => ({
        normalized: row.normalized,
        count: row._count._all,
      })),
      demoData: demoData as unknown as Record<string, number>,
      placeholderSettings: placeholders,
    };
  }
}
