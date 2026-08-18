import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Payloads already carrying pagination metadata skip re-wrapping. */
interface MaybeEnveloped {
  data?: unknown;
  meta?: unknown;
}

/**
 * Wraps every successful response in the shared `{ data, meta? }` envelope.
 *
 * Controllers return plain objects; the envelope is applied in exactly one
 * place, so it cannot drift endpoint by endpoint.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined || payload === null) {
          return { data: null };
        }

        // A service that already built the envelope (paginated lists) passes through.
        const candidate = payload as MaybeEnveloped;
        if (
          typeof payload === 'object' &&
          candidate.data !== undefined &&
          Object.keys(candidate).every((key) => key === 'data' || key === 'meta')
        ) {
          return payload;
        }

        return { data: payload };
      }),
    );
  }
}
