import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { DemoModule } from './demo/demo.module';
import { HealthModule } from './health/health.module';

/**
 * Root module.
 *
 * Modular monolith: one deployable, with each business area as its own NestJS
 * module and cross-module access going through services rather than direct
 * table reads. Business modules (auth, catalogue, machines, customers, sales,
 * files, search, notifications, documents, analytics, admin) are added in
 * Stage 1.4 onward.
 *
 * DiscoveryModule is imported so the boot-time route-coverage assertion can
 * enumerate controllers.
 */
@Module({
  imports: [DiscoveryModule, AppConfigModule, PrismaModule, RedisModule, DemoModule, HealthModule],
})
export class AppModule {}
