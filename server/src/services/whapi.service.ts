// ============================================
// WHAPI (WhatsApp) Service
// ============================================

import config from '../config/index.js';
import { InternalError } from '../utils/errors.js';

// ============================================
// Types
// ============================================

interface WhapiResponse {
  sent: boolean;
  message_id?: string;
  error?: string;
}

interface SendTextOptions {
  to: string;
  body: string;
}

interface SendDocumentOptions {
  to: string;
  mediaUrl: string;
  filename: string;
  mimeType?: string;
  caption?: string;
}

interface SendImageOptions {
  to: string;
  mediaUrl: string;
  mimeType?: string;
  caption?: string;
}

// ============================================
// Helpers
// ============================================

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parentheses, and plus sign
  return phone.replace(/[\s\-\(\)\+]/g, '');
}

async function whapiRequest(endpoint: string, body: Record<string, unknown>): Promise<WhapiResponse> {
  const { apiUrl, token } = config.whapi;

  if (!token) {
    throw new InternalError('WHAPI token not configured');
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('WHAPI error:', response.status, data);
    throw new InternalError(`WhatsApp send failed: ${data?.error?.message || response.statusText}`);
  }

  return { sent: true, message_id: data.message_id };
}

// ============================================
// Send Functions
// ============================================

export async function sendText({ to, body }: SendTextOptions): Promise<WhapiResponse> {
  const phone = normalizePhone(to);
  return whapiRequest('/messages/text', {
    to: phone,
    body,
  });
}

export async function sendDocument({ to, mediaUrl, filename, mimeType, caption }: SendDocumentOptions): Promise<WhapiResponse> {
  const phone = normalizePhone(to);
  return whapiRequest('/messages/document', {
    to: phone,
    media: mediaUrl,
    mime_type: mimeType || 'application/pdf',
    filename,
    caption: caption || '',
  });
}

export async function sendImage({ to, mediaUrl, mimeType, caption }: SendImageOptions): Promise<WhapiResponse> {
  const phone = normalizePhone(to);
  return whapiRequest('/messages/image', {
    to: phone,
    media: mediaUrl,
    mime_type: mimeType || 'image/jpeg',
    caption: caption || '',
  });
}

// ============================================
// Status
// ============================================

export function isConfigured(): boolean {
  return !!config.whapi.token;
}
