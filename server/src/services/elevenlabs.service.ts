// ============================================
// ElevenLabs Service
// ============================================

import config from '../config/index.js';
import { InternalError, BadRequestError } from '../utils/errors.js';
import * as agentConfigService from './agentConfig.service.js';

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
  if (agentSecretName) {
    // 1. Check DB first (admin-configured)
    try {
      const dbAgentId = await agentConfigService.resolve(agentSecretName);
      if (dbAgentId) return dbAgentId;
    } catch (error) {
      console.warn(`Failed to resolve agent "${agentSecretName}" from DB, falling back to env var:`, error);
    }

    // 2. Fallback to environment variable
    const envAgentId = process.env[agentSecretName];
    if (envAgentId) return envAgentId;

    console.warn(`Agent "${agentSecretName}" not found in DB or env, falling back to default`);
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
  // Resolve API key from DB first, then env var
  const apiKey = await agentConfigService.resolveApiKey();
  if (!apiKey) {
    throw new InternalError('ElevenLabs API key not configured');
  }

  const agentId = await resolveAgentId(agentSecretName);

  // Check cache first
  const cached = getCachedUrl(agentId);
  if (cached) {
    return cached;
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
    console.error('ElevenLabs API error:', response.status, errorText);
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
