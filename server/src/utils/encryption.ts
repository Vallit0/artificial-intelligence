// AES-256-GCM at-rest encryption for sensitive secrets (LTI tool private
// key today, room to grow). The data key is derived from JWT_SECRET with
// HKDF-SHA256 and an info string scoped to the use case, so each consumer
// gets a distinct key without adding env vars. Rotating JWT_SECRET will
// invalidate ciphertexts — that is acceptable here because the tool key is
// re-bootstrapped automatically on next start.

import crypto from 'crypto';
import config from '../config/index.js';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(info: string): Buffer {
  const ikm = Buffer.from(config.jwtSecret, 'utf8');
  const salt = Buffer.alloc(0);
  const derived = crypto.hkdfSync('sha256', ikm, salt, Buffer.from(info, 'utf8'), KEY_LENGTH);
  return Buffer.from(derived);
}

export function encryptSecret(plaintext: string, info: string): string {
  const key = deriveKey(info);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

export function decryptSecret(payload: string, info: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Malformed ciphertext');
  }
  const key = deriveKey(info);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
