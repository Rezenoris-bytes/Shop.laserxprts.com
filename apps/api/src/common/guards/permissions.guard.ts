import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@lei/shared';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator';

/**
 * Authorization guard, registered globally, DENY BY DEFAULT.
 *
 * A route that is neither @Public() nor @RequirePermission() is rejected at
 * runtime here, and refuses to boot at all thanks to the route-coverage
 * assertion. Two layers, because "someone forgot to guard an endpoint" is the
 * most common RBAC failure and it is normally invisible until exploited.
 *
 * Authorization reads `admin_permissions` and nothing else. `User.department`
 * is descriptive — it pre-fills permission templates in the admin UI, and is
 * never consulted here. Two sources of authorization truth inevitably diverge.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, controller])) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [handler, controller],
    );

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Login is the whole requirement for account-self-service routes.
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_KEY, [handler, controller])) {
      return true;
    }

    // No declaration means the route was never authorised for anyone.
    if (!required) {
      throw new ForbiddenException('This action is not permitted');
    }

    // SUPER_ADMIN is the owner account: full access by definition, which is
    // why audit logs and settings need no separate permission rows for it.
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const granted = user.permissions[required.module];
    if (!granted?.[required.action]) {
      throw new ForbiddenException(
        `You do not have permission to ${required.action} ${required.module.toLowerCase()}`,
      );
    }

    return true;
  }
}
