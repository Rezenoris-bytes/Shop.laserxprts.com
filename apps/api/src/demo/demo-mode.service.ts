import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DemoModeRepository, SeedDataCensus } from './demo-mode.repository';

/**
 * DEMO_MODE — one flag, every demo behaviour.
 *
 * When true:
 *   - robots.txt disallows everything; X-Robots-Tag: noindex on every response
 *   - the storefront shows a persistent sample-data banner
 *   - quote PDFs carry a "SAMPLE — NOT A COMMERCIAL DOCUMENT" watermark
 *   - seed records are visibly chipped in the admin UI
 *
 * The reason this matters: the staging deployment sits on a subdomain of a real
 * trading company's domain, carrying invented compatibility claims and
 * placeholder prices. If it were indexed, those claims would appear in search
 * results under the LEI brand.
 */
@Injectable()
export class DemoModeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoModeService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly repository: DemoModeRepository,
  ) {}

  get enabled(): boolean {
    return this.config.demoMode;
  }

  /**
   * Boot-time safety rail.
   *
   * Refuses to start with DEMO_MODE=false while demo data or placeholder
   * settings are still present. Without this, going live is a checklist item
   * someone eventually forgets, and the failure is silent: real customers
   * see invented compatibility claims and placeholder pricing.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.enabled) {
      this.logger.warn('DEMO_MODE is ON — indexing blocked, sample banner shown, quote PDFs watermarked.');
      return;
    }

    const [census, placeholders] = await Promise.all([
      this.repository.censusSeedData(),
      this.repository.findPlaceholderSettings(),
    ]);

    const seedTotal = Object.values(census).reduce((sum, count) => sum + count, 0);
    const problems: string[] = [];

    if (seedTotal > 0) {
      const detail = Object.entries(census)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => `      ${table}: ${count}`)
        .join('\n');
      problems.push(`  ${seedTotal} seed-data rows are still present:\n${detail}`);
    }

    if (placeholders.length > 0) {
      problems.push(
        `  ${placeholders.length} settings still hold PLACEHOLDER values:\n` +
          placeholders.map((key) => `      ${key}`).join('\n'),
      );
    }

    if (problems.length > 0) {
      this.logger.error(
        '\n\nDEMO_MODE is OFF but the database is not production-ready. Refusing to start.\n\n' +
          `${problems.join('\n\n')}\n\n` +
          '  Run the seed purge and replace the placeholder settings before going live.\n',
      );
      process.exit(1);
    }

    this.logger.log('Production checks passed: no seed data, no placeholder settings.');
  }

  /** Current census, surfaced to the admin dashboard. */
  async census(): Promise<SeedDataCensus> {
    return this.repository.censusSeedData();
  }

  /** Banner copy, served to the frontend so the wording lives in one place. */
  get bannerText(): string {
    return (
      'Demonstration environment — product, pricing and compatibility data is sample data ' +
      'and is not verified LEI information.'
    );
  }

  get pdfWatermarkText(): string {
    return 'SAMPLE — NOT A COMMERCIAL DOCUMENT';
  }
}
