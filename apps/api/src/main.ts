import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/**
 * Boot tracing that survives a broken log pipeline.
 *
 * Hostinger's Runtime Logs panel does not capture this app's stdout — the
 * early listener demonstrably runs and answers requests, yet not a single
 * console line ever reaches the panel. That left a hung startup completely
 * undiagnosable. These traces are written synchronously to a file under
 * STORAGE_ROOT (readable in hPanel's File Manager) so the last line written
 * tells you exactly which stage the boot reached before stalling.
 *
 * Synchronous on purpose: a queued async write is lost if the process hangs
 * or is killed, which is precisely the case being debugged.
 */
const BOOT_LOG = join(process.env.STORAGE_ROOT ?? process.cwd(), 'boot-debug.log');

/** Set once the API is fully serving, so the watchdog knows to stand down. */
let booted = false;

function trace(stage: string, detail?: unknown): void {
  const line =
    `[${new Date().toISOString()}] ${stage}` +
    (detail === undefined
      ? ''
      : ` :: ${detail instanceof Error ? (detail.stack ?? detail.message) : JSON.stringify(detail)}`) +
    '\n';
  try {
    appendFileSync(BOOT_LOG, line);
  } catch {
    // Never let tracing itself break startup.
  }
  // eslint-disable-next-line no-console
  console.log(line.trimEnd());
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  trace('bootstrap:start', {
    node: process.version,
    cwd: process.cwd(),
    storageRoot: process.env.STORAGE_ROOT ?? '(unset)',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    port: process.env.PORT ?? '(unset)',
  });

  // 1. Phusion Passenger (Hostinger) requires listen() within 3 seconds.
  // NestJS + Prisma initialization can take longer, causing a PANIC timeout.
  // We bind the port immediately with a raw server to satisfy the timeout.
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

  let isReady = false;
  let appHandler: any = null;

  const server = createServer((req, res) => {
    if (isReady && appHandler) {
      appHandler(req, res);
    } else {
      res.statusCode = 503;
      res.setHeader('Retry-After', '5');
      res.end('API is starting up. Please try again in a few seconds.');
    }
  });
  server.listen(port, '0.0.0.0');
  logger.log(`Early listener started on port ${port} to satisfy Hostinger timeout.`);
  trace('early-listener:bound', { port });

  // 2. Provide this existing server to Fastify.
  const adapter = new FastifyAdapter({
    serverFactory: (handler: any) => {
      appHandler = handler;

      // Prevent Fastify from throwing EADDRINUSE when Nest calls app.listen()
      // But we MUST invoke the callback Fastify passes, or its internal state corrupts.
      server.listen = (...args: any[]) => {
        const cb = args.find((arg) => typeof arg === 'function');
        if (cb) {
          process.nextTick(cb);
        }
        return server as any;
      };
      return server;
    },
    // Real client IP. Behind Cloudflare every request otherwise appears to come
    // from a Cloudflare address, which would make a per-IP rate limiter block
    // every visitor at once the moment any single one tripped a limit.
    trustProxy: true,
    genReqId: () => randomUUID(),
    bodyLimit: 2 * 1024 * 1024,
  });

  // bufferLogs is deliberately OFF. With it on, Nest holds every log line in
  // memory until app.useLogger() is called — and if module initialisation
  // hangs or throws before that point, the explanation is buffered and never
  // printed. That combination produced completely empty runtime logs while the
  // early listener served "API is starting up" indefinitely, leaving no way to
  // see what actually failed.
  trace(
    'nest:create:begin  <-- if this is the last line, module init (usually the DB connection) is hanging',
  );
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  trace('nest:create:done');

  const config = app.get(AppConfigService);
  trace('config:loaded', {
    storageRoot: config.storageRoot,
    resolvedStorageRoot: resolve(config.storageRoot),
    demoMode: config.demoMode,
    allowedOrigins: config.allowedOrigins,
  });

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
  trace(
    'static:register:begin  <-- if this is the last line, STORAGE_ROOT is likely unreadable/missing',
  );
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

  trace('static:register:done');

  // NOT app.listen(). The port was already bound by the early listener above,
  // and that server emitted 'listening' at the time. Fastify's listen() waits
  // for a fresh 'listening' event on the server it was handed — an event that
  // has already fired and will never fire again — so app.listen() hung here
  // forever, leaving the app permanently answering "starting up".
  //
  // With an externally-owned server the correct sequence is to initialise Nest
  // (which registers the routes onto the Fastify instance) and then await
  // Fastify's own ready(), which finalises plugin and route registration
  // without touching the socket.
  trace('app:init:begin');
  await app.init();
  trace('app:init:done');

  trace('fastify:ready:begin');
  await app.getHttpAdapter().getInstance().ready();
  trace('fastify:ready:done');

  isReady = true;
  booted = true;
  trace('READY  <-- API is fully serving');
  logger.log(`LEI API listening on ${config.apiUrl}`);
  logger.log(`Environment: ${config.nodeEnv}  |  DEMO_MODE: ${config.demoMode ? 'ON' : 'OFF'}`);
  logger.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
}

// A bare `void bootstrap()` discards any rejection, so a failure during
// startup left no trace at all — the process just sat there with the early
// listener answering 503 forever. Print it and exit non-zero instead, so the
// platform reports a crashed app rather than a permanently "starting" one.
bootstrap().catch((error: unknown) => {
  trace('FATAL:bootstrap-failed', error);
  // eslint-disable-next-line no-console
  console.error('FATAL: API bootstrap failed', error);
  process.exit(1);
});

// A hang leaves no trace of its own, so record one from the outside: if the
// boot has not reported READY within 45s, write what we know and exit rather
// than sitting there answering "starting up" forever with nothing logged.
const watchdog = setTimeout(() => {
  if (booted) return;
  trace('WATCHDOG:boot-did-not-complete-in-45s — exiting so the platform reports a crash');
  process.exit(1);
}, 45_000);
watchdog.unref();
