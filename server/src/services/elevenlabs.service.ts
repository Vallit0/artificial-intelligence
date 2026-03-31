// ============================================
// ElevenLabs Service
// ============================================

import config from '../config/index.js';
import { InternalError, BadRequestError } from '../utils/errors.js';

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
 * Resolves an agent ID from either:
 * - An environment variable name (e.g., "ELEVENLABS_AGENT_PROSPECTING_PAREJA")
 * - Falls back to the default ELEVENLABS_AGENT_ID
 */
function resolveAgentId(agentSecretName?: string | null): string {
  if (agentSecretName) {
    // Look up the agent ID from environment variables
    const agentId = process.env[agentSecretName];
    if (agentId) {
      return agentId;
    }
    console.warn(`Agent secret "${agentSecretName}" not found in env, falling back to default`);
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
  if (!config.elevenlabs.apiKey) {
    throw new InternalError('ElevenLabs API key not configured');
  }

  const agentId = resolveAgentId(agentSecretName);

  // Check cache first
  const cached = getCachedUrl(agentId);
  if (cached) {
    return cached;
  }

  const tokenUrl = `${config.elevenlabs.conversationUrl}?agent_id=${agentId}`;

  const response = await fetch(tokenUrl, {
    method: 'GET',
    headers: {
      'xi-api-key': config.elevenlabs.apiKey,
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

export function isConfigured(): boolean {
  return !!(config.elevenlabs.apiKey && config.elevenlabs.agentId);
}
