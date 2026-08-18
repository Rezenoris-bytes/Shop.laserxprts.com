import { SetMetadata } from '@nestjs/common';
import type { PermissionAction, PermissionModule } from '@lei/shared';

export const PERMISSION_KEY = 'lei:permission';

export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

/**
 * Declares the module permission a route requires.
 *
 * The guard resolves this against the `admin_permissions` table and nothing
 * else — never against User.department, which is descriptive only. Two sources
 * of authorization truth inevitably diverge.
 */
export const RequirePermission = (module: PermissionModule, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission);
