import { INestApplication, Logger, Type } from '@nestjs/common';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { DiscoveryService } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Deny-by-default authorization, enforced at boot.
 *
 * Every controller route must declare itself either @Public() or
 * @RequirePermission(...). A route that declares neither is a route someone
 * forgot to guard — the single most common RBAC failure mode, and one that
 * normally reaches production silently because nothing tests for the absence of
 * a decorator.
 *
 * This turns that class of mistake into a failed deployment: the process
 * refuses to start and names the offending handlers.
 */
export function assertEveryRouteIsGuarded(app: INestApplication): void {
  const logger = new Logger('RouteCoverage');
  const discovery = app.get(DiscoveryService);
  const reflector = app.get(Reflector);
  const scanner = new MetadataScanner();

  const unguarded: string[] = [];
  let publicCount = 0;
  let authOnlyCount = 0;
  let guardedCount = 0;

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;

    const controller = metatype as Type<unknown>;
    const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
    const prototype = Object.getPrototypeOf(instance) as object;

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = (instance as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;

      // Only actual route handlers carry a path.
      const routePath = Reflect.getMetadata(PATH_METADATA, handler);
      if (routePath === undefined) continue;

      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, controller]);
      const isAuthOnly = reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_KEY, [
        handler,
        controller,
      ]);
      const permission = reflector.getAllAndOverride(PERMISSION_KEY, [handler, controller]);

      if (isPublic) {
        publicCount += 1;
      } else if (isAuthOnly) {
        authOnlyCount += 1;
      } else if (permission) {
        guardedCount += 1;
      } else {
        unguarded.push(`${controller.name}.${methodName}  (/${controllerPath}/${routePath})`);
      }
    }
  }

  if (unguarded.length > 0) {
    logger.error(
      `\n\n${unguarded.length} route(s) declare neither @Public() nor @RequirePermission().\n` +
        'Authorization is deny-by-default, so the API will not start.\n\n' +
        unguarded.map((route) => `  - ${route}`).join('\n') +
        '\n',
    );
    process.exit(1);
  }

  logger.log(
    `Route coverage OK — ${publicCount} public, ${authOnlyCount} auth-only, ` +
      `${guardedCount} permission-guarded, 0 unguarded.`,
  );
}
