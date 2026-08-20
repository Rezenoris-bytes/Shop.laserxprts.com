import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService, type AccessTokenPayload } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Authentication guard, registered globally.
 *
 * The access token is read from the Authorization header only — never from a
 * cookie. That is what makes the admin panel immune to CSRF: a forged
 * cross-site request can carry cookies, but it cannot set an Authorization
 * header. The refresh cookie is the sole cookie-borne credential, and it is
 * only ever accepted by the /auth/refresh endpoint.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = header.slice('Bearer '.length).trim();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });
    } catch {
      throw new UnauthorizedException('Session expired');
    }

    // Loaded fresh on each request rather than trusted from the token, so
    // deactivating an account or changing its permissions takes effect
    // immediately instead of at the next token refresh.
    const user = await this.auth.loadUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Session expired');
    }

    (request as FastifyRequest & { user?: unknown }).user = user;
    return true;
  }
}
