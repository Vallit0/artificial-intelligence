// ============================================
// ElevenLabs Service
// ============================================

import config from '../config/index.js';
import { InternalError, BadRequestError } from '../utils/errors.js';
import * as agentConfigService from './agentConfig.service.js';
import { getLogger } from '../utils/logger.js';

// ============================================
// Signed URL Cache (per agentId, TTL-based)
// ============================================

interface CachedUrl {
  signedUrl: string;
  expiresAt: number;
}

const urlCache = new Map<string, CachedUrl>();
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (signed URLs typically expire in ~5min)

function getCachedUrl(agentId: string): string | null {
  const cached = urlCache.get(agentId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.signedUrl;
  }
  urlCache.delete(agentId);
  return null;
}

function setCachedUrl(agentId: string, signedUrl: string): void {
  urlCache.set(agentId, {
    signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================
// Agent ID Resolution
// ============================================

// ============================================
// Enrutamiento por país
// ============================================
//
// Cada país puede tener su propio agente de ElevenLabs (habla distinto en
// Guatemala que en México). La convención es un SUFIJO en el secret name:
//   ELEVENLABS_AGENT_COACH      → agente base (default / Guatemala)
//   ELEVENLABS_AGENT_COACH_MX   → agente para usuarios cuya sede es de México
// Si el sufijo no está configurado (DB ni env), se usa el base. Así agregar
// un país nuevo no requiere código: sólo configurar `<SECRET>_<ISO2>` en el
// panel admin de agentes.

export function countrySecretName(agentSecretName: string, country?: string | null): string | null {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return `${agentSecretName}_${code}`;
}

// Busca un secret name en DB (admin) y luego en env. null si no existe en ninguno.
async function lookupAgentId(
  secretName: string,
  log: ReturnType<typeof getLogger>,
): Promise<{ agentId: string; source: 'db' | 'env' } | null> {
  try {
    const dbAgentId = await agentConfigService.resolve(secretName);
    if (dbAgentId) return { agentId: dbAgentId, source: 'db' };
  } catch (error) {
    log.warn({ err: error, secretName }, 'Failed to resolve agent from DB, falling back to env var');
  }
  const envAgentId = process.env[secretName];
  if (envAgentId) return { agentId: envAgentId, source: 'env' };
  return null;
}

export interface ResolvedAgent {
  agentId: string;
  // Secret name que terminó usándose (con sufijo de país si aplicó). Es la
  // clave correcta para buscar overrides de prompt / experimentos A/B: si se
  // enrutó al agente de MX no hay que inyectarle el prompt del agente base.
  effectiveSecretName: string | null;
  // true si se usó una variante por país distinta del nombre base.
  countryRouted: boolean;
}

/**
 * Resolves an agent ID from:
 * 0. Country variant `<secretName>_<ISO2>` (DB, then env) when the user has a country
 * 1. Database (AgentConfig table) - admin-managed
 * 2. Environment variable fallback
 * 3. Default ELEVENLABS_AGENT_ID
 */
export async function resolveAgent(
  agentSecretName?: string | null,
  country?: string | null,
): Promise<ResolvedAgent> {
  const log = getLogger({ component: 'elevenlabs', op: 'resolve-agent' });

  if (agentSecretName) {
    // 0. Variante por país (sólo si el usuario tiene país y existe el agente).
    const variantName = countrySecretName(agentSecretName, country);
    if (variantName) {
      const variant = await lookupAgentId(variantName, log);
      if (variant) {
        log.info(
          { agentSecretName, country, effectiveSecretName: variantName, source: variant.source, resolvedAgentId: variant.agentId },
          'agent resolved (country variant)',
        );
        return { agentId: variant.agentId, effectiveSecretName: variantName, countryRouted: true };
      }
    }

    // 1-2. Nombre base: DB primero (admin-configured), luego env.
    const base = await lookupAgentId(agentSecretName, log);
    if (base) {
      log.info(
        { agentSecretName, country: country ?? null, source: base.source, resolvedAgentId: base.agentId },
        'agent resolved',
      );
      return { agentId: base.agentId, effectiveSecretName: agentSecretName, countryRouted: false };
    }

    // 3. Requested a specific agent but it isn't in DB or env. Routing to the
    // default agent here connects the user to the WRONG agent (the Coach) while
    // the controller still injects the override prompt resolved for the
    // requested secretName → "se inyecta un prompt incorrecto". Surfaced loudly.
    log.warn(
      { agentSecretName, source: 'fallback-default', resolvedAgentId: config.elevenlabs.agentId },
      'MISROUTE: agent not found in DB or env, falling back to DEFAULT agent',
    );
  }

  if (!config.elevenlabs.agentId) {
    throw new InternalError('No ElevenLabs agent configured');
  }

  return {
    agentId: config.elevenlabs.agentId,
    effectiveSecretName: agentSecretName ?? null,
    countryRouted: false,
  };
}

// ============================================
// Conversation Token
// ============================================

export interface ConversationSignedUrl extends ResolvedAgent {
  signedUrl: string;
}

export async function getConversationSignedUrl(
  agentSecretName?: string | null,
  country?: string | null,
): Promise<ConversationSignedUrl> {
  // Kick off both lookups in parallel — they hit different tables and don't depend on each other.
  const agentPromise = resolveAgent(agentSecretName, country);
  const apiKeyPromise = agentConfigService.resolveApiKey();
  const resolved = await agentPromise;
  const signedUrl = await getSignedUrlForAgentId(resolved.agentId, apiKeyPromise);
  return { ...resolved, signedUrl };
}

// Pide (o sirve desde cache) el signed URL de un agentId ya resuelto. Separado
// de resolveAgent() para que el controller pueda resolver el agente efectivo
// (lookups rápidos a Postgres) y luego paralelizar este round-trip a ElevenLabs
// con los demás lookups de overrides/A-B.
export async function getSignedUrlForAgentId(
  agentId: string,
  apiKeyPromise: Promise<string> = agentConfigService.resolveApiKey(),
): Promise<string> {
  // Cache is keyed by agentId, so check as soon as it resolves.
  // On a hit we skip the external fetch and the apiKey promise becomes a harmless no-op.
  const cached = getCachedUrl(agentId);
  if (cached) {
    return cached;
  }

  const apiKey = await apiKeyPromise;
  if (!apiKey) {
    throw new InternalError('ElevenLabs API key not configured');
  }

  const tokenUrl = `${config.elevenlabs.conversationUrl}?agent_id=${agentId}`;

  const response = await fetch(tokenUrl, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    getLogger({ component: 'elevenlabs', op: 'signed-url' }).error(
      { statusCode: response.status, errorText },
      'ElevenLabs API error',
    );
    throw new InternalError('Failed to get conversation token');
  }

  const data = await response.json();
  const signedUrl = data.signed_url;

  // Cache the signed URL
  setCachedUrl(agentId, signedUrl);

  return signedUrl;
}

// ============================================
// Status Check
// ============================================

export async function isConfigured(): Promise<boolean> {
  const apiKey = await agentConfigService.resolveApiKey();
  return !!(apiKey && config.elevenlabs.agentId);
}
