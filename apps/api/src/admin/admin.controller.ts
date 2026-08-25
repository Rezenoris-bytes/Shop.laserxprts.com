import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuditAction,


  createAdminUserSchema,
  updateSettingSchema,
  type CreateAdminUserInput,
  type UpdateSettingInput,
} from '@lei/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBody } from '../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DashboardService } from './dashboard.service';
import { UsersService } from './users.service';

/**
 * Owner-level administration.
 *
 * Users, permissions, audit logs and settings are all SUPER_ADMIN territory —
 * these routes carry the module permission decorator for route-coverage
 * bookkeeping, but PermissionsGuard short-circuits any SUPER_ADMIN to true
 * regardless, and no ADMIN department template grants USERS/AUDIT/SETTINGS.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  @Get('dashboard')

  getDashboard() {
    return this.dashboard.get();
  }

  // ── Users ─────────────────────────────────────────────────────────────

  @Get('users')

  listUsers() {
    return this.users.list();
  }

  @Post('users')

  createUser(
    @Body(ZodBody(createAdminUserSchema)) body: CreateAdminUserInput,
    @CurrentUser('id') actorId: number,
  ) {
    return this.users.create(body, actorId);
  }

  @Patch('users/:id/deactivate')

  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.users.deactivate(id, actorId);
  }

  @Patch('users/:id/activate')

  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.users.activate(id, actorId);
  }

  // ── Audit log ─────────────────────────────────────────────────────────

  @Get('audit-logs')

  async auditLogs(
    @Query('page') page = '1',
    @Query('perPage') perPage = '50',
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const take = Math.min(Number(perPage) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const { items, total } = await this.audit.list({ skip, take, entityType, entityId });
    return { data: items, meta: { pagination: { page: Number(page) || 1, perPage: take, total } } };
  }

  // ── Settings ──────────────────────────────────────────────────────────

  @Get('settings')

  async listSettings() {
    const all = await this.settings.all();
    // Secrets are masked, not omitted — the admin should see that a value is
    // set without being able to read it back over the API.
    return all.map((setting) => ({
      ...setting,
      value: setting.isSecret ? '••••••••' : setting.value,
    }));
  }

  @Patch('settings/:key')

  async updateSetting(
    @Param('key') key: string,
    @Body(ZodBody(updateSettingSchema)) body: UpdateSettingInput,
    @CurrentUser('id') actorId: number,
  ) {
    const setting = await this.settings.set(key, body.value, actorId);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Setting',
      entityId: key,
      newValues: { key },
    });
    return setting;
  }
}
