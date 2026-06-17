// ============================================
// Rate limiters for sensitive auth endpoints
// ============================================
// Each limiter is per-IP. Numbers chosen to allow normal usage (typos, bouncing
// between machines) but block credential-stuffing and password-spray attacks.

import rateLimit from 'express-rate-limit';

// En tests el limiter es contraproducente: la suite corre secuencialmente
// (fileParallelism:false) contra el mismo app/IP y haría 429 a partir del
// décimo login. Lo saltamos sólo en NODE_ENV=test; en dev/prod sigue activo.
const skipInTests = () => process.env.NODE_ENV === 'test';

// Login + signup: 10 requests / 15 min / IP. Counts all attempts (success or
// fail) so a single IP can't pummel the endpoint even if credentials are
// rotated.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Demasiados intentos, intenta de nuevo en 15 minutos.' },
});

// Password reset request: 5 / hour / IP. Bigger window because users typically
// retry only after checking email.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Demasiadas solicitudes de reset, intenta de nuevo en 1 hora.' },
});
