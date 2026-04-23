// ============================================
// Sentry instrumentation — must be imported FIRST
// ============================================
//
// In @sentry/node v8+, instrumentation hooks into `require`/`import` the
// moment `Sentry.init()` runs. Anything loaded before this file boots
// (Express, Prisma, fetch) will NOT be auto-instrumented. Keep this as the
// very first import in src/index.ts.

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: process.env.npm_package_version,
    // Keep traces modest by default; overridable via env for ramp-ups.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // Scrub common secrets even if a call site forgets to redact.
    sendDefaultPii: false,
  });
} else if (environment === 'production') {
  // eslint-disable-next-line no-console
  console.warn('⚠️ SENTRY_DSN not set in production — errors will not be reported');
}

export { Sentry };
