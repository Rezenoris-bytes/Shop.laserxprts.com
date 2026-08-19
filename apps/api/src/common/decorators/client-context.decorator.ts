import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface ClientContext {
  ip?: string;
  userAgent?: string;
  sessionKey?: string;
}

/**
 * Client identity for audit entries and rate limiting.
 *
 * `request.ip` is correct behind Cloudflare only because Fastify is started
 * with trustProxy and Nginx sets real_ip_header CF-Connecting-IP. Without that
 * chain every request looks like it came from one Cloudflare address, and a
 * per-IP limit would block every visitor at once.
 */
export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientContext => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const sessionKey = request.headers['x-session-key'];

    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      sessionKey: typeof sessionKey === 'string' ? sessionKey : undefined,
    };
  },
);
