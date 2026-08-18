import { Injectable, Logger } from '@nestjs/common';
import type { ComponentHealth, HealthStatus } from '@lei/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Health reporting.
 *
 * UptimeRobot hitting `/` only proves Nginx is alive. This endpoint proves the
 * things that actually break: the database connection, Redis, and whether
 * migrations are applied — plus the build identity, so a deployment can be
 * identified without SSH.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async check(): Promise<HealthStatus & { migrationsApplied: number }> {
    const [database, redis, migrationsApplied] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.countMigrations(),
    ]);

    // Redis being down degrades the service (rate limiting fails open) but does
    // not take it out. A database failure is fatal.
    let status: HealthStatus['status'] = 'ok';
    if (database.status === 'error') {
      status = 'error';
    } else if (redis.status === 'error') {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      version: this.config.version,
      commit: this.config.commit,
      demoMode: this.config.demoMode,
      migrationsApplied,
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const latencyMs = await this.prisma.ping();
      return { status: 'ok', latencyMs };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Database health check failed: ${message}`);
      return { status: 'error', message };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    try {
      const latencyMs = await this.redis.ping();
      return { status: 'ok', latencyMs };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Redis health check failed: ${message}`);
      return { status: 'error', message };
    }
  }

  private async countMigrations(): Promise<number> {
    try {
      return await this.prisma.appliedMigrationCount();
    } catch {
      return -1;
    }
  }
}
