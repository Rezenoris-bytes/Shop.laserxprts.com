import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/**
 * Typed accessor over the validated environment.
 *
 * Modules inject this rather than ConfigService directly, so every config read
 * is type-checked and there are no stringly-typed `get('SOME_KEY')` calls
 * scattered through the codebase.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true }) as Env[K];
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  /**
   * True on staging/demo deployments. Every demo behaviour in the application
   * reads this one flag — see DemoModeService.
   */
  get demoMode(): boolean {
    return this.get('DEMO_MODE');
  }

  get siteUrl(): string {
    return this.get('SITE_URL').replace(/\/+$/, '');
  }

  get apiUrl(): string {
    return this.get('API_URL').replace(/\/+$/, '');
  }

  get allowedOrigins(): string[] {
    return this.get('ALLOWED_ORIGINS');
  }

  get cookieDomain(): string {
    return this.get('COOKIE_DOMAIN');
  }

  get apiPort(): number {
    return this.get('API_PORT');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string | undefined {
    return this.get('REDIS_URL');
  }

  get jwtAccessSecret(): string {
    return this.get('JWT_ACCESS_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.get('JWT_REFRESH_SECRET');
  }

  get jwtAccessTtlSeconds(): number {
    return this.get('JWT_ACCESS_TTL');
  }

  get jwtRefreshTtlSeconds(): number {
    return this.get('JWT_REFRESH_TTL');
  }

  get storageRoot(): string {
    return this.get('STORAGE_ROOT');
  }

  get revalidateSecret(): string | undefined {
    return this.get('REVALIDATE_SECRET');
  }

  get maxUploadBytes(): number {
    return this.get('MAX_UPLOAD_BYTES');
  }

  get mailProvider(): Env['MAIL_PROVIDER'] {
    return this.get('MAIL_PROVIDER');
  }

  get mailApiKey(): string | undefined {
    return this.get('MAIL_API_KEY');
  }

  get mailFromAddress(): string {
    return this.get('MAIL_FROM_ADDRESS');
  }

  get mailFromName(): string {
    return this.get('MAIL_FROM_NAME');
  }

  /** In demo mode outbound mail is restricted to these addresses. */
  get mailDemoAllowlist(): string[] {
    return this.get('MAIL_DEMO_ALLOWLIST');
  }

  get rateLimitTtlSeconds(): number {
    return this.get('RATE_LIMIT_TTL');
  }

  get rateLimitMax(): number {
    return this.get('RATE_LIMIT_MAX');
  }

  /** Build metadata, surfaced by /health so a deployment can be identified. */
  get version(): string {
    return process.env.APP_VERSION ?? '0.1.0';
  }

  get commit(): string {
    return process.env.GIT_COMMIT ?? 'local';
  }
}
