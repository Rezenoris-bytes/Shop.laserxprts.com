import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode, type ApiError } from '@lei/shared';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Single exit point for every error.
 *
 * Two jobs:
 *   1. Every failure leaves as the same JSON envelope, so the frontend has one
 *      error shape to handle.
 *   2. Internal detail never reaches the client in production. Prisma errors in
 *      particular name tables and columns, which is free reconnaissance.
 *
 * The full error is always logged server-side with a requestId the user can
 * quote, so support does not lose the diagnostic detail the client is denied.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = request.id as string;

    const { status, body } = this.resolve(exception, requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${status} ${body.error.code}`,
      );
    }

    void reply.status(status).send(body);
  }

  private resolve(exception: unknown, requestId: string): { status: number; body: ApiError } {
    // ── Nest HTTP exceptions ────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null && 'error' in response) {
        // Already an ApiError (thrown by the validation pipe).
        const typed = response as ApiError;
        return {
          status,
          body: { error: { ...typed.error, requestId } },
        };
      }

      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);

      return {
        status,
        body: {
          error: {
            code: this.codeForStatus(status),
            message: Array.isArray(message) ? message.join('; ') : message,
            requestId,
          },
        },
      };
    }

    // ── Prisma known errors ─────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrisma(exception, requestId);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: ErrorCode.VALIDATION_FAILED,
            message: 'The request could not be processed.',
            requestId,
          },
        },
      };
    }

    // ── Anything else ───────────────────────────────────────────────────
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          // Only non-production sees the real message.
          message: this.config.isProduction
            ? 'An unexpected error occurred.'
            : ((exception as Error)?.message ?? 'Unknown error'),
          requestId,
        },
      },
    };
  }

  private resolvePrisma(
    exception: Prisma.PrismaClientKnownRequestError,
    requestId: string,
  ): { status: number; body: ApiError } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: ErrorCode.CONFLICT,
              message: 'A record with these details already exists.',
              requestId,
            },
          },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            error: { code: ErrorCode.NOT_FOUND, message: 'Record not found.', requestId },
          },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: ErrorCode.CONFLICT,
              message: 'This record is referenced by other data and cannot be changed.',
              requestId,
            },
          },
        };
      default:
        this.logger.error(`[${requestId}] Unhandled Prisma error ${exception.code}`);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: {
            error: {
              code: ErrorCode.INTERNAL_ERROR,
              message: 'A database error occurred.',
              requestId,
            },
          },
        };
    }
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
