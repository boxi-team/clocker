import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'INVALID_PARAMETER'
  | 'UNAUTHORIZED'
  | 'CHAMPION_NOT_FOUND'
  | 'PLAYER_NOT_FOUND'
  | 'MATCH_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_MATCH'
  | 'RATE_LIMITED'
  | 'REFRESH_COOLDOWN'
  | 'DATA_NOT_READY'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export const notFound = (code: ErrorCode, message: string) => new AppError(404, code, message);
export const dataNotReady = () =>
  new AppError(503, 'DATA_NOT_READY', 'No data synced yet. Run POST /v1/admin/sync first.');

/** Uniform `{ error: { code, message, details? } }` for every failure. */
export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.setErrorHandler((err: FastifyError | AppError | ZodError, req, reply) => {
    if (err instanceof AppError) {
      if (err.retryAfter) reply.header('Retry-After', String(err.retryAfter));
      return reply
        .code(err.status)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Invalid request parameters',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    if ('statusCode' in err && err.statusCode === 429) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
    if ('statusCode' in err && err.statusCode && err.statusCode < 500) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: 'INVALID_PARAMETER', message: err.message } });
    }
    req.log.error(err);
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });
}
