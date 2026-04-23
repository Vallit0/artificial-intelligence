// ============================================
// Structured Logger (pino) + request context
// ============================================
//
// Every log call automatically includes the current requestId when emitted
// from within a request-handling context. Use `getLogger()` in service /
// controller code; use `rootLogger` for startup, shutdown, and anything that
// runs outside a request.

import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger } from 'pino';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  base: { service: 'senoriales-server' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.jwtSecret',
    ],
    censor: '[REDACTED]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,service' },
        },
      }),
});

/**
 * Returns a logger bound to the current request context. Outside a request
 * (startup, background jobs) it returns the root logger unchanged.
 */
export function getLogger(extraBindings?: Record<string, unknown>): Logger {
  const ctx = als.getStore();
  if (!ctx && !extraBindings) return rootLogger;
  return rootLogger.child({ ...(ctx ?? {}), ...(extraBindings ?? {}) });
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}
