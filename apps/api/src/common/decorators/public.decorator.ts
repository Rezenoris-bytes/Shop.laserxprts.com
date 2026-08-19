import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'lei:isPublic';
export const IS_AUTHENTICATED_KEY = 'lei:isAuthenticated';

/**
 * Marks a route as reachable without authentication.
 *
 * Authorization is DENY BY DEFAULT: the boot-time route assertion fails the
 * process if a route carries none of @Public(), @Authenticated() or
 * @RequirePermission(). That converts "someone forgot to guard an endpoint"
 * from a silent production vulnerability into a failed deployment.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires a signed-in admin but no particular module permission.
 *
 * For routes that act on the caller's own account — /auth/me, changing your
 * own password — where a module permission would be meaningless.
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
