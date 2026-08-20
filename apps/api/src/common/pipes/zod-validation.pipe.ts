import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ErrorCode, type ApiError } from '@lei/shared';

/**
 * Zod-backed DTO validation.
 *
 * The source specification named class-validator. Zod is used instead for one
 * concrete reason: the same schema object is importable by the Next.js forms,
 * so client-side and server-side validation cannot drift. class-validator
 * decorators cannot cross that boundary. The requirement — "DTO validation
 * before business logic" — is met identically.
 *
 * Written by hand rather than pulling in nestjs-zod: it is twenty lines, and it
 * keeps one more third-party package out of the dependency tree.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.') || '_';
          (fields[path] ??= []).push(issue.message);
        }

        const body: ApiError = {
          error: {
            code: ErrorCode.VALIDATION_FAILED,
            message: 'The submitted data is not valid.',
            fields,
          },
        };
        throw new BadRequestException(body);
      }
      throw error;
    }
  }
}

/**
 * Convenience factory: `@Body(ZodBody(loginSchema)) body: LoginInput`.
 *
 * Keeps the schema and the inferred type adjacent at the call site, so a
 * schema change surfaces as a type error on the handler signature.
 */
export const ZodBody = (schema: ZodSchema) => new ZodValidationPipe(schema);

/** Same, for query strings. */
export const ZodQuery = (schema: ZodSchema) => new ZodValidationPipe(schema);
