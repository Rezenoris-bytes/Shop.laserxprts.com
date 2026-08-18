import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

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
  const base = new PrismaClient({
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

  async onModuleInit(): Promise<void> {
    await this.raw.$connect();
    this.logger.log('Database connected');
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
