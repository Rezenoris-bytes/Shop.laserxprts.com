import { Injectable, Logger } from '@nestjs/common';
import type { ComponentHealth, HealthStatus } from '@lei/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health reporting.
 *
 * UptimeRobot hitting `/` only proves Nginx is alive. This endpoint proves the
 * things that actually break: the database connection and whether migrations
 * are applied — plus the build identity, so a deployment can be identified
 * without SSH.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async check(): Promise<HealthStatus & { migrationsApplied: number }> {
    const [database, migrationsApplied] = await Promise.all([
      this.checkDatabase(),
      this.countMigrations(),
    ]);

    const status: HealthStatus['status'] = database.status === 'error' ? 'error' : 'ok';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      version: this.config.version,
      commit: this.config.commit,
      demoMode: this.config.demoMode,
      migrationsApplied,
      checks: { database },
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

  private async countMigrations(): Promise<number> {
    try {
      return await this.prisma.appliedMigrationCount();
    } catch {
      return -1;
    }
  }
}
