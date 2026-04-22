// ============================================
// Latency Probe Service
// ============================================
// Mide round-trip a servicios externos y a la DB para el panel admin.
// Cada probe corre con timeout para que un servicio lento no bloquee al resto.
//
// El probe de ElevenLabs pega al endpoint real de voz
// (GET /v1/convai/conversation/get-signed-url) para que refleje la latencia
// que siente el usuario al iniciar una sesion hablada.

import config from '../config/index.js';
import prisma from '../db/index.js';
import * as agentConfigService from './agentConfig.service.js';

export type ProbeService = 'database' | 'elevenlabs';

export interface ProbeResult {
  service: ProbeService;
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
  skipped?: boolean;
  target?: string;
  detail?: string;
}

export interface ProbeReport {
  timestamp: string;
  totalMs: number;
  probes: ProbeResult[];
}

const PROBE_TIMEOUT_MS = 5000;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: unknown }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ms: performance.now() - start, value };
  } catch (error) {
    return { ms: performance.now() - start, error };
  }
}

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = PROBE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.name === 'AbortError' ? `timeout after ${PROBE_TIMEOUT_MS}ms` : err.message;
  return String(err);
}

// ============================================
// Individual probes
// ============================================

async function probeDatabase(): Promise<ProbeResult> {
  const { ms, error } = await timed(() => prisma.$queryRaw`SELECT 1`);
  return {
    service: 'database',
    ok: !error,
    latencyMs: Math.round(ms),
    target: 'SELECT 1',
    ...(error ? { error: errorMessage(error) } : {}),
  };
}

// Resolve an agent ID to probe voice endpoint.
// Prefers an active AgentConfig in DB; falls back to env default.
async function resolveVoiceAgent(): Promise<{ agentId: string; label: string } | null> {
  try {
    const active = await prisma.agentConfig.findFirst({
      where: { isActive: true, agentId: { not: '' } },
      select: { agentId: true, label: true, secretName: true },
      orderBy: { secretName: 'asc' },
    });
    if (active?.agentId) {
      return { agentId: active.agentId, label: active.label || active.secretName };
    }
  } catch (error) {
    console.warn('Latency probe: could not read AgentConfig, falling back to env:', error);
  }
  if (config.elevenlabs.agentId) {
    return { agentId: config.elevenlabs.agentId, label: 'ELEVENLABS_AGENT_ID (env)' };
  }
  return null;
}

async function probeElevenLabs(): Promise<ProbeResult> {
  const target = 'GET /v1/convai/conversation/get-signed-url';
  const apiKey = await agentConfigService.resolveApiKey();
  if (!apiKey) {
    return { service: 'elevenlabs', ok: false, latencyMs: 0, skipped: true, target, error: 'API key not configured' };
  }

  const agent = await resolveVoiceAgent();
  if (!agent) {
    return {
      service: 'elevenlabs',
      ok: false,
      latencyMs: 0,
      skipped: true,
      target,
      error: 'No active voice agent configured',
    };
  }

  const url = `${config.elevenlabs.conversationUrl}?agent_id=${encodeURIComponent(agent.agentId)}`;
  const { ms, value, error } = await timed(() =>
    fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    })
  );

  const detail = `agente: ${agent.label}`;

  if (error) {
    return { service: 'elevenlabs', ok: false, latencyMs: Math.round(ms), target, detail, error: errorMessage(error) };
  }

  const ok = value!.ok;
  let errorText: string | undefined;
  if (!ok) {
    try {
      const body = await value!.text();
      errorText = body ? `HTTP ${value!.status}: ${body.slice(0, 120)}` : `HTTP ${value!.status}`;
    } catch {
      errorText = `HTTP ${value!.status}`;
    }
  }

  return {
    service: 'elevenlabs',
    ok,
    latencyMs: Math.round(ms),
    status: value!.status,
    target,
    detail,
    ...(ok ? {} : { error: errorText }),
  };
}

// ============================================
// Public API
// ============================================

export async function runAllProbes(): Promise<ProbeReport> {
  const start = performance.now();
  const probes = await Promise.all([
    probeDatabase(),
    probeElevenLabs(),
  ]);
  return {
    timestamp: new Date().toISOString(),
    totalMs: Math.round(performance.now() - start),
    probes,
  };
}
