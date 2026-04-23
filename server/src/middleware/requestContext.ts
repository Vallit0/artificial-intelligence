// ============================================
// Request context middleware
// ============================================
//
// Generates (or propagates) a request ID, stores it in AsyncLocalStorage so
// any `getLogger()` call deep in the call stack inherits it, echoes it back
// on the `X-Request-Id` response header, and emits one structured access log
// per request via pino-http.

import type { Request, Response, NextFunction } from 'express';
import { pinoHttp } from 'pino-http';
import { nanoid } from 'nanoid';

import { rootLogger, runWithContext } from '../utils/logger.js';

const REQUEST_ID_HEADER = 'x-request-id';

function resolveRequestId(req: Request): string {
  const incoming = req.header(REQUEST_ID_HEADER);
  return incoming && incoming.length <= 64 ? incoming : nanoid(12);
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  runWithContext({ requestId }, () => next());
}

export const httpLogger = pinoHttp({
  logger: rootLogger,
  genReqId: (req) => (req as Request & { requestId?: string }).requestId ?? nanoid(12),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  autoLogging: {
    ignore: (req) => req.url === '/health' || (req.url?.startsWith('/health/') ?? false),
  },
});
