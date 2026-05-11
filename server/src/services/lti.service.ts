// LTI Advantage outbound — sign client_assertion JWTs and exchange them at
// the platform's token endpoint for short-lived access tokens. The grant
// is `client_credentials` per IMS LTI 1.3 / RFC 7523, with scopes specific
// to each Advantage Service (AGS, NRPS, Deep Linking).
//
// Access tokens are cached in-process keyed by (platformId, sortedScopes)
// and reused until 30s before exp — Moodle issues 1h tokens by default,
// so this avoids one round-trip per AGS call during a busy hour.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db/index.js';
import { getActiveSigningKey } from './toolKey.service.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger({ component: 'lti-outbound' });

const ASSERTION_TTL_SECONDS = 300;
const TOKEN_REFRESH_LEEWAY_MS = 30_000;

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedAccessToken>();

function cacheKey(platformId: string, scopes: string[]): string {
  return `${platformId}::${[...scopes].sort().join(' ')}`;
}

interface PlatformForGrant {
  id: string;
  clientId: string;
  tokenEndpoint: string;
}

export async function signClientAssertion(platform: PlatformForGrant): Promise<string> {
  const { kid, algorithm, privateKey } = await getActiveSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: platform.clientId,
    sub: platform.clientId,
    aud: platform.tokenEndpoint,
    iat: now,
    exp: now + ASSERTION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, privateKey, {
    algorithm: algorithm as jwt.Algorithm,
    keyid: kid,
  });
}

export async function getPlatformAccessToken(
  platformId: string,
  scopes: string[],
): Promise<string> {
  const key = cacheKey(platformId, scopes);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - TOKEN_REFRESH_LEEWAY_MS > Date.now()) {
    return cached.accessToken;
  }

  const platform = await prisma.ltiPlatform.findUnique({
    where: { id: platformId },
    select: { id: true, clientId: true, tokenEndpoint: true, isActive: true },
  });
  if (!platform || !platform.isActive) {
    throw new Error(`LTI platform ${platformId} not found or inactive`);
  }

  const assertion = await signClientAssertion(platform);

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: scopes.join(' '),
  });

  const res = await fetch(platform.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    log.warn({ platformId, status: res.status, body: errText.slice(0, 300) }, 'Token grant failed');
    throw new Error(`Token grant failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Token grant returned no access_token');
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  tokenCache.set(key, {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return data.access_token;
}

// Test helper.
export function _resetTokenCache(): void {
  tokenCache.clear();
}
