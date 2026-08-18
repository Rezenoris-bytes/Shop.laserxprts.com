import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

/**
 * Redis is used for exactly two things, deliberately:
 *
 *   1. Rate limiting
 *   2. Refresh-token family tracking / reuse detection
 *
 * There is NO application cache layer. At LEI's traffic an indexed MySQL on the
 * same host answers fast enough, and a cache in front of it would add an
 * invalidation bug surface for no measurable gain.
 *
 * Failure policy (explicit, because unspecified failure modes become outages):
 *   - Rate limiting FAILS OPEN. Redis being down must not take the site down;
 *     it logs loudly instead.
 *   - Token reuse detection FAILS CLOSED. A security check that cannot run must
 *     reject, not allow.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private connected = false;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    this.client = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
    });

    this.client.on('ready', () => {
      this.connected = true;
      this.logger.log('Redis connected');
    });
    this.client.on('error', (error: Error) => {
      this.connected = false;
      this.logger.error(`Redis error: ${error.message}`);
    });
    this.client.on('close', () => {
      this.connected = false;
    });

    void this.client.connect().catch((error: Error) => {
      this.logger.error(`Redis initial connection failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => this.client?.disconnect());
      this.client = null;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Raw client access. Returns null when Redis is unavailable so callers must
   * make an explicit fail-open / fail-closed decision rather than crashing.
   */
  getClient(): Redis | null {
    return this.connected ? this.client : null;
  }

  /** Liveness probe used by /health. */
  async ping(): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialised');
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  /**
   * Fixed-window counter used by the rate limiter.
   * Returns null when Redis is unavailable, which the limiter treats as
   * "allow" (fail open).
   */
  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const results = await client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
      const value = results?.[0]?.[1];
      return typeof value === 'number' ? value : null;
    } catch (error) {
      this.logger.warn(`Rate-limit increment failed, failing open: ${(error as Error).message}`);
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    return client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  }

  async del(key: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;
    await client.del(key);
    return true;
  }
}
