// LTI tool keypair management. The tool needs an RSA keypair to (a) sign
// client_assertion JWTs when calling Moodle's AGS/NRPS endpoints with the
// client_credentials grant, and (b) sign Deep Linking responses. Public
// JWK is exposed at /lti/jwks; private key is stored AES-GCM encrypted.
//
// The active key is cached in-process so we don't decrypt on every signing
// call. ensureToolKey() runs at boot and creates the first key if missing.

import crypto from 'crypto';
import prisma from '../db/index.js';
import { encryptSecret, decryptSecret } from '../utils/encryption.js';
import { getLogger } from '../utils/logger.js';

const ENCRYPTION_INFO = 'lti-tool-key-v1';
const log = getLogger({ component: 'tool-key' });

export interface SigningKey {
  kid: string;
  algorithm: string;
  privateKey: crypto.KeyObject;
}

interface CachedSigningKey extends SigningKey {
  loadedAt: number;
}

let cachedSigningKey: CachedSigningKey | null = null;

function generateRsaKeypair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export async function ensureToolKey(): Promise<void> {
  const existing = await prisma.toolKey.findFirst({ where: { isActive: true } });
  if (existing) {
    log.info({ kid: existing.kid }, 'Active LTI tool key present');
    return;
  }

  const { publicPem, privatePem } = generateRsaKeypair();
  const kid = crypto.randomUUID();
  const privateKeyEnc = encryptSecret(privatePem, ENCRYPTION_INFO);

  await prisma.toolKey.create({
    data: {
      kid,
      algorithm: 'RS256',
      publicKeyPem: publicPem,
      privateKeyEnc,
      isActive: true,
    },
  });

  log.info({ kid }, 'Generated new LTI tool key');
}

export async function getActiveSigningKey(): Promise<SigningKey> {
  if (cachedSigningKey) return cachedSigningKey;

  const row = await prisma.toolKey.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) {
    throw new Error('No active LTI tool key — ensureToolKey() not run at boot');
  }

  const privatePem = decryptSecret(row.privateKeyEnc, ENCRYPTION_INFO);
  const privateKey = crypto.createPrivateKey({ key: privatePem, format: 'pem' });

  cachedSigningKey = {
    kid: row.kid,
    algorithm: row.algorithm,
    privateKey,
    loadedAt: Date.now(),
  };
  return cachedSigningKey;
}

export interface PublicJwk {
  kty: 'RSA';
  use: 'sig';
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export async function getPublicJwks(): Promise<{ keys: PublicJwk[] }> {
  // Serve every key with isActive=true — during a rotation window we may
  // briefly have two so platforms with cached JWKS can still verify
  // assertions signed by either.
  const rows = await prisma.toolKey.findMany({ where: { isActive: true } });
  const keys = rows.map((row) => {
    const publicKey = crypto.createPublicKey({ key: row.publicKeyPem, format: 'pem' });
    const jwk = publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };
    return {
      kty: 'RSA' as const,
      use: 'sig' as const,
      alg: row.algorithm,
      kid: row.kid,
      n: jwk.n,
      e: jwk.e,
    };
  });
  return { keys };
}

// Test helper — clears the in-process cache so a fresh row gets picked up.
export function _resetSigningKeyCache(): void {
  cachedSigningKey = null;
}
