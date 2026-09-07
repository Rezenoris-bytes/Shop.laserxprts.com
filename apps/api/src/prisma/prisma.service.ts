import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Builds the driver adapter from DATABASE_URL by hand rather than passing the
 * URL straight through, since the `mariadb` package's own URL parser doesn't
 * reliably surface a unix-socket path (`?socket=`) the way Prisma's engine
 * URL convention does — an explicit config object is unambiguous.
 */
function buildAdapter(databaseUrl: string): PrismaMariaDb {
  const url = new URL(databaseUrl);
  const socketPath = url.searchParams.get('socket');

  return new PrismaMariaDb({
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    ...(socketPath
      ? { socketPath }
      : { host: url.hostname, port: url.port ? Number(url.port) : 3306 }),
    // Without these the driver waits indefinitely for a connection it may never
    // get. A hang here is far worse than a failure: Nest's module init awaits
    // $connect(), so the whole app sits half-started with nothing logged and no
    // error raised — which is exactly what happened on Hostinger. Bounding the
    // wait turns that silent hang into a real, reportable error.
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
    initializationTimeout: 10_000,
  });
}

/**
 * Models carrying a `deletedAt` column.
 *
 * Prisma has no global query scope, so soft-delete filtering is applied by the
 * client extension below. Anything not listed here is read normally.
 */
const SOFT_DELETABLE = new Set<string>([
  'User',
  'File',
  'Category',
  'PartBrand',
  'Product',
  'ProductVariant',
  'Customer',
  'Service',
]);

/** Read operations the extension rewrites to exclude soft-deleted rows. */
const FILTERED_READS = new Set<string>([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

function buildClient(logQueries: boolean) {
  const adapter = buildAdapter(process.env.DATABASE_URL ?? '');
  const base = new PrismaClient({
    adapter,
    log: logQueries
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
  });

  return base.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SOFT_DELETABLE.has(model) || !FILTERED_READS.has(operation)) {
            return query(args);
          }

          // An explicit `deletedAt` in the caller's filter wins — that is how a
          // repository asks for deleted rows on purpose (restore, audit views).
          const typedArgs = args as { where?: Record<string, unknown> };
          const where = typedArgs.where ?? {};
          if ('deletedAt' in where) {
            return query(args);
          }

          return query({ ...typedArgs, where: { ...where, deletedAt: null } } as typeof args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof buildClient>;

/**
 * Database access point.
 *
 * Only `*.repository.ts` files may inject this — enforced by an ESLint rule, so
 * the "controllers never touch Prisma" boundary cannot erode silently.
 *
 * Repositories use `prisma.client`, which is the extended client with
 * soft-delete filtering applied. `prisma.raw` is the unextended client, for the
 * rare case that needs it (health checks, raw full-text queries, the seed).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  public readonly raw: PrismaClient;
  public readonly client: ExtendedPrismaClient;

  /** Whether the warm-up connection has succeeded; surfaced by /health. */
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  constructor() {
    const logQueries = process.env.PRISMA_LOG_QUERIES === 'true';
    this.client = buildClient(logQueries);
    // The extension returns a proxy over the same connection pool, so this is
    // the same underlying client rather than a second set of connections.
    this.raw = this.client as unknown as PrismaClient;

    if (logQueries) {
      (
        this.raw as unknown as { $on: (e: string, cb: (ev: Prisma.QueryEvent) => void) => void }
      ).$on('query', (event) => this.logger.debug(`${event.duration}ms  ${event.query}`));
    }
  }

  /**
   * Startup must never depend on the database being reachable.
   *
   * Nest blocks the whole bootstrap on this hook, so throwing here kills the
   * process: a momentary blip on the database host during a deploy took the
   * entire API down until someone intervened by hand. Prisma opens connections
   * lazily on first query regardless — $connect() only warms the pool — so a
   * failure here costs nothing but a slower first request.
   *
   * The connection is therefore attempted in the background and retried with
   * backoff. The app serves immediately either way, /health reports the real
   * database state, and a database that comes back is picked up on its own
   * without a redeploy.
   */
  onModuleInit(): void {
    void this.connectWithRetry();
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    const MAX_ATTEMPTS = 10;
    const TIMEOUT_MS = 15_000;

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database connection timed out after ${TIMEOUT_MS / 1000}s`)),
        TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([this.raw.$connect(), timeout]);
      this.connected = true;
      this.logger.log(`Database connected${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
    } catch (error) {
      this.connected = false;
      const message = error instanceof Error ? error.message : String(error);

      if (attempt >= MAX_ATTEMPTS) {
        this.logger.error(
          `Database connection failed after ${MAX_ATTEMPTS} attempts: ${message}. ` +
            'The API stays up and will connect on the next successful query.',
        );
        return;
      }

      // 2s, 4s, 8s … capped at 30s.
      const delayMs = Math.min(2_000 * 2 ** (attempt - 1), 30_000);
      this.logger.warn(
        `Database connection failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${message}. ` +
          `Retrying in ${delayMs / 1000}s.`,
      );
      setTimeout(() => void this.connectWithRetry(attempt + 1), delayMs).unref();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect();
    this.logger.log('Database disconnected');
  }

  /** Liveness probe used by /health. */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.raw.$queryRaw`SELECT 1`;
    return Date.now() - start;
  }

  /** Number of migrations recorded as applied — surfaced by /health. */
  async appliedMigrationCount(): Promise<number> {
    const rows = await this.raw.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
