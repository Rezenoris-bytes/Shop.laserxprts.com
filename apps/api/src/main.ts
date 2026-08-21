import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { assertEveryRouteIsGuarded } from './common/guards/route-coverage.assertion';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const adapter = new FastifyAdapter({
    // Real client IP. Behind Cloudflare every request otherwise appears to come
    // from a Cloudflare address, which would make a per-IP rate limiter block
    // every visitor at once the moment any single one tripped a limit.
    trustProxy: true,
    genReqId: () => randomUUID(),
    bodyLimit: 2 * 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  // ── Security headers ──────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // The API serves JSON; the storefront sets its own CSP.
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  await app.register(fastifyCookie, {
    secret: config.jwtRefreshSecret,
    parseOptions: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      domain: config.cookieDomain,
      path: '/',
    },
  });

  // ── DEMO_MODE: block indexing at the server, not just via meta tags ───
  // The staging deployment sits on a subdomain of a real trading company's
  // domain and carries invented compatibility data and placeholder prices.
  // A header cannot be missed the way a per-page meta tag can.
  if (config.demoMode) {
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onSend', (_request, reply, payload, done) => {
        void reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        done(null, payload);
      });
  }

  // ── Uploads ───────────────────────────────────────────────────────────
  // Admin image uploads only. The global bodyLimit stays small — this raises
  // the ceiling for multipart parts alone, so a large JSON payload is still
  // refused everywhere else.
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 12,
      fields: 20,
    },
  });

  // ── Product images ────────────────────────────────────────────────────
  // Served straight off disk under /uploads. These are content-addressed —
  // the filename is the SHA-256 of the bytes — so a given URL can never point
  // at different content and is safe to cache indefinitely. Registered before
  // the global prefix is set so the path stays /uploads, not /api/v1/uploads.
  await app.register(fastifyStatic, {
    root: resolve(config.storageRoot),
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
    // Filenames are the SHA-256 of the bytes, so a URL can never point at
    // different content and is safe to cache for a year. Set through the
    // plugin's own options rather than the setHeaders hook, which is what the
    // plugin documents for cache headers.
    maxAge: 31536000000,
    immutable: true,
    // Never execute anything from the upload directory, whatever its extension.
    // `header`, not `setHeader`: @fastify/static v10 hands the hook a
    // FastifyReply where v8 passed the raw ServerResponse.
    setHeaders: (reply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Content-Disposition', 'inline');
    },
  });

  // ── CORS: explicit allowlist, never a wildcard ────────────────────────
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Key'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // No global ValidationPipe: DTO validation is done per-route with
  // ZodValidationPipe, so the same schema object is importable by the Next.js
  // forms and client/server validation cannot drift. Nest's ValidationPipe
  // would additionally pull in class-validator for no added guarantee.
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(config));

  app.enableShutdownHooks();

  // Deny-by-default: refuses to start if any route is unguarded.
  assertEveryRouteIsGuarded(app);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.apiPort;
  await app.listen(port, '0.0.0.0');

  logger.log(`LEI API listening on ${config.apiUrl}`);
  logger.log(`Environment: ${config.nodeEnv}  |  DEMO_MODE: ${config.demoMode ? 'ON' : 'OFF'}`);
  logger.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
}

void bootstrap();
