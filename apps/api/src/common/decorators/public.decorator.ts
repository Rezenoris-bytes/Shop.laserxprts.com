import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'lei:isPublic';

/**
 * Marks a route as reachable without authentication.
 *
 * Authorization is DENY BY DEFAULT: the boot-time route assertion fails the
 * process if any route carries neither @Public() nor @RequirePermission().
 * That converts "someone forgot to guard an endpoint" from a silent production
 * vulnerability into a failed deployment.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
