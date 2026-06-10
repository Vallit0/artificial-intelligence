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

/**
 * Resolves an agent ID from:
 * 1. Database (AgentConfig table) - admin-managed
 * 2. Environment variable fallback
 * 3. Default ELEVENLABS_AGENT_ID
 */
async function resolveAgentId(agentSecretName?: string | null): Promise<string> {
  const log = getLogger({ component: 'elevenlabs', op: 'resolve-agent' });

  if (agentSecretName) {
    // 1. Check DB first (admin-configured)
    try {
      const dbAgentId = await agentConfigService.resolve(agentSecretName);
      if (dbAgentId) {
        log.info({ agentSecretName, source: 'db', resolvedAgentId: dbAgentId }, 'agent resolved');
        return dbAgentId;
      }
    } catch (error) {
      log.warn(
        { err: error, agentSecretName },
        'Failed to resolve agent from DB, falling back to env var',
      );
    }

    // 2. Fallback to environment variable
    const envAgentId = process.env[agentSecretName];
    if (envAgentId) {
      log.info({ agentSecretName, source: 'env', resolvedAgentId: envAgentId }, 'agent resolved');
      return envAgentId;
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

  return config.elevenlabs.agentId;
}

// ============================================
// Conversation Token
// ============================================

export async function getConversationSignedUrl(agentSecretName?: string | null): Promise<string> {
  // Kick off both lookups in parallel — they hit different tables and don't depend on each other.
  const agentIdPromise = resolveAgentId(agentSecretName);
  const apiKeyPromise = agentConfigService.resolveApiKey();

  const agentId = await agentIdPromise;

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
