import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { DemoModule } from './demo/demo.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { SettingsModule } from './settings/settings.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { SalesModule } from './sales/sales.module';
import { CustomersModule } from './customers/customers.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

/**
 * Root module — modular monolith, one deployable.
 *
 * Both guards are registered globally and in this order: JwtAuthGuard
 * establishes who the caller is, PermissionsGuard decides what they may do.
 * Registering them globally (rather than per-controller) is what makes
 * deny-by-default real — a new controller is protected the moment it exists,
 * without anyone remembering to add a decorator.
 */
@Module({
  imports: [
    DiscoveryModule,
    AppConfigModule,
    PrismaModule,
    DemoModule,
    AuditModule,
    SettingsModule,
    FilesModule,
    JwtModule.register({}),
    AuthModule,
    CatalogueModule,
    SalesModule,
    CustomersModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
