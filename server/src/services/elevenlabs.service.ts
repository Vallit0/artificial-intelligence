// ============================================
// ElevenLabs Service
// ============================================

import config from '../config/index.js';
import { InternalError, BadRequestError } from '../utils/errors.js';

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
  return data.signed_url;
}

// ============================================
// Scribe Token (Real-time Transcription)
// ============================================

export async function getScribeToken(): Promise<string> {
  if (!config.elevenlabs.apiKey) {
    throw new InternalError('ElevenLabs not configured');
  }

  const response = await fetch(config.elevenlabs.scribeUrl, {
    method: 'POST',
    headers: {
      'xi-api-key': config.elevenlabs.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs Scribe API error:', response.status, errorText);
    throw new InternalError('Failed to get scribe token');
  }

  const data = await response.json();
  return data.token;
}

// ============================================
// Status Check
// ============================================

export function isConfigured(): boolean {
  return !!(config.elevenlabs.apiKey && config.elevenlabs.agentId);
}
