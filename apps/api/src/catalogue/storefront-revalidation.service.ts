import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

/**
 * Purges the storefront's ISR cache after a catalogue write.
 *
 * The storefront caches category trees and facets for an hour and listings for
 * five minutes. Without this an admin saves a product and watches nothing
 * change, which reads as the save having failed.
 *
 * FIRE AND FORGET, deliberately. A save must not fail because the storefront
 * is down or slow — the worst case without revalidation is content that is
 * briefly stale, which is exactly what the cache window already allows.
 */
@Injectable()
export class StorefrontRevalidationService {
  private readonly logger = new Logger(StorefrontRevalidationService.name);

  constructor(private readonly config: AppConfigService) {}

  /**
   * Paths affected by a change to one product.
   *
   * The category slug is passed in rather than looked up: this service holds no
   * database access, and every caller has just read or written the product it
   * is revalidating.
   */
  revalidateProduct(categorySlug?: string | null): void {
    const paths = ['/', '/catalogue'];
    if (categorySlug) paths.push(`/catalogue?category=${categorySlug}`);
    this.revalidate(paths);
  }

  /** Categories and brands change the index, the tiles and every listing. */
  revalidateCatalogue(): void {
    this.revalidate(['/', '/catalogue']);
  }

  private revalidate(paths: string[]): void {
    const secret = this.config.revalidateSecret;
    if (!secret) {
      this.logger.debug('REVALIDATE_SECRET not set — skipping storefront revalidation');
      return;
    }

    void fetch(new URL('/api/revalidate', this.config.siteUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => {
        if (!response.ok) {
          this.logger.warn(`Storefront revalidation returned ${response.status}`);
        }
      })
      .catch((error: Error) => {
        this.logger.warn(`Storefront revalidation failed: ${error.message}`);
      });
  }
}
