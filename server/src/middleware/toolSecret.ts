// ============================================
// Server-tool shared-secret middleware
// ============================================
// ElevenLabs invokes /api/memory/retrieve and /api/memory/save directly from
// its server-side runtime — there is no logged-in user, so JWT auth doesn't
// apply. Instead we share a secret with ElevenLabs and require it in the
// `X-Tool-Secret` header.  Without this, anyone could POST to those routes
// with any user_id and read or pollute another user's coaching memory.
//
// Configuration:
//   1. Set TOOL_SHARED_SECRET in .env (use `openssl rand -base64 32`).
//   2. In ElevenLabs server-tool config, add header `X-Tool-Secret: <same>`.
//   3. Refusal is fail-closed: if the env var is missing in production the
//      route is rejected outright.
// ============================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/index.js';

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export type ToolSecretCheck =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'invalid' };

// Evaluates the shared secret WITHOUT sending a response, so each caller can
// decide how to react to a failure: hard-block (see requireToolSecret, used by
// /save) or degrade gracefully (see the /retrieve controller, which must never
// hang a live conversation with a 401/500).
export function checkToolSecret(req: Request): ToolSecretCheck {
  const expected = process.env.TOOL_SHARED_SECRET;

  if (!expected) {
    // Fail-closed in production; permissive in dev for local testing.
    return config.isProduction ? { ok: false, reason: 'not-configured' } : { ok: true };
  }

  const provided = req.header('x-tool-secret');
  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true };
}

export function requireToolSecret(req: Request, res: Response, next: NextFunction): void {
  const check = checkToolSecret(req);

  if (check.ok) {
    if (!process.env.TOOL_SHARED_SECRET) {
      // Dev-only path (prod not-configured is already rejected below). Log a
      // loud warning so the developer notices instead of silently accepting.
      // eslint-disable-next-line no-console
      console.warn('[security] TOOL_SHARED_SECRET is not set — /api/memory tool endpoints are open. Set it in .env.');
    }
    next();
    return;
  }

  if (check.reason === 'not-configured') {
    res.status(500).json({ error: 'Server tool secret not configured' });
    return;
  }
  res.status(401).json({ error: 'Invalid tool secret' });
}
