import { z } from 'zod';

/**
 * Environment schema.
 *
 * Every variable the API reads is declared here and validated at boot. If one
 * is missing or malformed the process exits immediately with a readable list
 * of problems, rather than failing later with an undefined-variable error in
 * whichever request first happens to need it.
 *
 * Nothing in this file — or anywhere in the codebase — hardcodes a hostname.
 * Moving to the production domain is a change to SITE_URL, ALLOWED_ORIGINS and
 * COOKIE_DOMAIN, plus DNS and TLS. No code change, no migration.
 */

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const portNumber = z.coerce.number().int().min(1).max(65535);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // ── Demo mode ─────────────────────────────────────────────────────────
    // Drives indexing blocks, the sample-data banner and PDF watermarking.
    // See DemoModeService for the runtime rails.
    DEMO_MODE: booleanFromString.default('true'),

    // ── Domain (production domain deferred — all env-driven) ──────────────
    SITE_URL: z.string().url(),
    API_URL: z.string().url(),
    ALLOWED_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    COOKIE_DOMAIN: z.string().min(1),

    API_PORT: portNumber.default(4000),

    // ── Port assigned by the host at runtime (e.g. Hostinger Passenger) ────
    // main.ts prefers this over API_PORT when present. Declared here purely
    // for documentation/validation; the raw env read in main.ts is what
    // actually decides the bound port.
    PORT: portNumber.optional(),

    // ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: z
      .string()
      .min(1)
      .refine((value) => value.startsWith('mysql://'), {
        message: 'DATABASE_URL must be a mysql:// connection string',
      }),

    // ── Auth ──────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

    // ── Storage ───────────────────────────────────────────────────────────
    // Files are stored OUTSIDE the web root and served via the API, so a
    // malicious upload can never be executed by the web server.
    STORAGE_ROOT: z.string().min(1).default('./storage'),

    /**
     * Shared secret for purging the storefront's ISR cache after an admin
     * write. Optional: absent, revalidation is skipped and the catalogue simply
     * refreshes on its normal schedule rather than the API failing to boot.
     */
    REVALIDATE_SECRET: z.string().min(8).optional(),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),

    // ── Rate limiting ─────────────────────────────────────────────────────
    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    // Production must not run on the default secrets or the console mailer.
    if (env.NODE_ENV === 'production') {
      if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'Access and refresh secrets must differ in production',
        });
      }
      if (!env.SITE_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SITE_URL'],
          message: 'SITE_URL must use https in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process.env and exits the process on failure.
 *
 * Failing here — loudly, at boot — is deliberate. A misconfigured deployment
 * that starts and then misbehaves is far harder to diagnose than one that
 * refuses to start and says why.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    // eslint-disable-next-line no-console
    console.error(
      `\nEnvironment validation failed. The API will not start.\n\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the missing values.\n`,
    );
    process.exit(1);
  }

  return result.data;
}
