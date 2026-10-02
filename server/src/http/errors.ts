import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

/** An expected failure with a stable machine code and a message safe to show to the shopper. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundApi(_req: Request, res: Response) {
  res.status(404).json({ error: 'API endpoint not found', code: 'not_found' });
}

// Keeps the existing `{ error: string }` response shape the storefront already reads.
export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Некорректные данные запроса',
      code: 'validation_error',
      details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }
  const parseError = error as { type?: string; status?: number };
  if (parseError?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body', code: 'bad_json' });
  if (parseError?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large', code: 'payload_too_large' });
  logger.error('Unhandled request error', error, { method: req.method, path: req.path, requestId: res.locals.requestId });
  res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'internal_error' });
}
