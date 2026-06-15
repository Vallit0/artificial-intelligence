// ============================================
// Health Service — dependency checks
// ============================================
//
// Powers /health/live and /health/ready. Checks are intentionally cheap and
// strictly time-boxed so a slow upstream never degrades the health endpoint.
// A dependency that is not configured returns `skipped` and does NOT cause
// readiness to fail — the server can still serve the parts that do work.

import prisma from '../db/index.js';
import config from '../config/index.js';

export type CheckStatus = 'up' | 'down' | 'skipped';

export interface DependencyCheck {
  name: string;
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: DependencyCheck[];
}

const READY_TIMEOUT_MS = 2000;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: unknown }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ms: performance.now() - start, value };
  } catch (error) {
    return { ms: performance.now() - start, error };
  }
}

function errMsg(err: unknown, timeoutMs: number): string {
  if (err instanceof Error) return err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : err.message;
  return String(err);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = READY_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// A fetch is considered "reachable" if the server answered at all, even with
// an auth/4xx error. 5xx and network failures mean the dependency is down.
function reachabilityFromStatus(status: number): CheckStatus {
  if (status >= 500) return 'down';
  return 'up';
}

async function checkDatabase(): Promise<DependencyCheck> {
  const { ms, error } = await timed(() => prisma.$queryRaw`SELECT 1`);
  return {
    name: 'database',
    status: error ? 'down' : 'up',
    latencyMs: Math.round(ms),
    ...(error ? { error: errMsg(error, READY_TIMEOUT_MS) } : {}),
  };
}

async function checkElevenLabs(): Promise<DependencyCheck> {
  if (!config.elevenlabs.apiKey) {
    return { name: 'elevenlabs', status: 'skipped', latencyMs: 0 };
  }
  const { ms, value, error } = await timed(() =>
    fetchWithTimeout(`${config.elevenlabs.conversationUrl}?agent_id=healthcheck`, {
      method: 'GET',
      headers: { 'xi-api-key': config.elevenlabs.apiKey },
    }),
  );
  if (error) {
    return { name: 'elevenlabs', status: 'down', latencyMs: Math.round(ms), error: errMsg(error, READY_TIMEOUT_MS) };
  }
  return {
    name: 'elevenlabs',
    status: reachabilityFromStatus(value!.status),
    latencyMs: Math.round(ms),
    ...(value!.status >= 500 ? { error: `HTTP ${value!.status}` } : {}),
  };
}

async function checkResend(): Promise<DependencyCheck> {
  if (!config.resendApiKey) {
    return { name: 'resend', status: 'skipped', latencyMs: 0 };
  }
  const { ms, value, error } = await timed(() =>
    fetchWithTimeout('https://api.resend.com/domains', {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.resendApiKey}` },
    }),
  );
  if (error) {
    return { name: 'resend', status: 'down', latencyMs: Math.round(ms), error: errMsg(error, READY_TIMEOUT_MS) };
  }
  return {
    name: 'resend',
    status: reachabilityFromStatus(value!.status),
    latencyMs: Math.round(ms),
    ...(value!.status >= 500 ? { error: `HTTP ${value!.status}` } : {}),
  };
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const checks = await Promise.all([
    checkDatabase(),
    checkElevenLabs(),
    checkResend(),
  ]);
  const anyDown = checks.some((c) => c.status === 'down');
  return {
    status: anyDown ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    checks,
  };
}
