// ============================================
// ElevenLabs Service
// ============================================

import config from '../config/index.js';
import { InternalError } from '../utils/errors.js';

// ============================================
// Conversation Token
// ============================================

export async function getConversationSignedUrl(): Promise<string> {
  if (!config.elevenlabs.apiKey || !config.elevenlabs.agentId) {
    throw new InternalError('ElevenLabs not configured');
  }

  const tokenUrl = `${config.elevenlabs.conversationUrl}?agent_id=${config.elevenlabs.agentId}`;

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
