/**
 * Shared API contract types.
 *
 * Both the NestJS API and the Next.js frontend import these, so a change to
 * the response envelope is a compile error on both sides rather than a
 * runtime surprise on one.
 */

/** Every successful API response uses this envelope. */
export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Every failed API response uses this envelope. */
export interface ApiError {
  error: {
    /** Stable machine-readable code, safe to branch on in the client. */
    code: string;
    /** Human-readable message. Never contains internal detail in production. */
    message: string;
    /** Field-level validation failures, keyed by field path. */
    fields?: Record<string, string[]>;
    /** Correlation id for matching a user report to a server log line. */
    requestId?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

/** Stable error codes. Add to this union rather than inventing strings. */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Health check payload — consumed by UptimeRobot and the deploy smoke test. */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  commit: string;
  demoMode: boolean;
  checks: {
    database: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'ok' | 'error';
  latencyMs?: number;
  message?: string;
}
