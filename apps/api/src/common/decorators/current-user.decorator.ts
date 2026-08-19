import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../auth/auth.service';

/** Injects the authenticated admin, populated by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);

/** SUPER_ADMIN-only routes still declare a module so route coverage passes. */
export const SUPER_ADMIN_ONLY = 'lei:superAdminOnly';
