import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { ensureToolKey, getPublicJwks, _resetSigningKeyCache } from '../../src/services/toolKey.service.js';
import { submitScoreForUser } from '../../src/services/ags.service.js';
import { _resetTokenCache } from '../../src/services/lti.service.js';

const PLATFORM = {
  name: 'Test Moodle',
  issuerUrl: 'https://moodle.test',
  clientId: 'test-client-id',
  authEndpoint: 'https://moodle.test/mod/lti/auth.php',
  tokenEndpoint: 'https://moodle.test/mod/lti/token.php',
  jwksUrl: 'https://moodle.test/mod/lti/certs.php',
  deploymentId: 'dep-1',
};

async function seedPlatformAndUser(opts: { agsLineitemUrl?: string | null; agsScopes?: string[] }) {
  const platform = await prisma.ltiPlatform.create({ data: PLATFORM });
  const user = await prisma.user.create({
    data: {
      email: 'student@test.local',
      emailVerified: true,
      roles: { create: { role: 'learner' } },
    },
  });
  const ltiSession = await prisma.ltiSession.create({
    data: {
      userId: user.id,
      platformId: platform.id,
      ltiUserId: 'lti-sub-123',
      ltiEmail: user.email,
      agsLineitemUrl: opts.agsLineitemUrl ?? null,
      agsScopes: opts.agsScopes ?? [],
      lastLaunchAt: new Date(),
    },
  });
  return { platform, user, ltiSession };
}

describe('LTI tool key bootstrap & JWKS', () => {
  beforeEach(async () => {
    await resetDatabase();
    _resetSigningKeyCache();
  });

  it('ensureToolKey crea un keypair activo si no existe', async () => {
    await ensureToolKey();
    const rows = await prisma.toolKey.findMany({ where: { isActive: true } });
    expect(rows.length).toBe(1);
    expect(rows[0].algorithm).toBe('RS256');
    expect(rows[0].publicKeyPem).toContain('PUBLIC KEY');
  });

  it('ensureToolKey es idempotente', async () => {
    await ensureToolKey();
    await ensureToolKey();
    const count = await prisma.toolKey.count({ where: { isActive: true } });
    expect(count).toBe(1);
  });

  it('GET /lti/jwks devuelve JWK pública con kid, n, e', async () => {
    await ensureToolKey();
    const res = await request(app).get('/lti/jwks');
    expect(res.status).toBe(200);
    expect(res.body.keys).toBeInstanceOf(Array);
    expect(res.body.keys.length).toBeGreaterThan(0);
    const key = res.body.keys[0];
    expect(key.kty).toBe('RSA');
    expect(key.use).toBe('sig');
    expect(key.alg).toBe('RS256');
    expect(typeof key.kid).toBe('string');
    expect(typeof key.n).toBe('string');
    expect(typeof key.e).toBe('string');
  });

  it('JWK pública verifica firmas hechas con la privada', async () => {
    await ensureToolKey();
    const { keys } = await getPublicJwks();
    const publicKey = crypto.createPublicKey({ key: keys[0] as crypto.JsonWebKey, format: 'jwk' });

    // Sign something with the private side via the same path the service uses.
    const { getActiveSigningKey } = await import('../../src/services/toolKey.service.js');
    const signing = await getActiveSigningKey();
    const token = jwt.sign({ hello: 'world' }, signing.privateKey, {
      algorithm: 'RS256',
      keyid: signing.kid,
    });

    expect(() => jwt.verify(token, publicKey, { algorithms: ['RS256'] })).not.toThrow();
  });
});

describe('AGS submitScoreForUser', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureToolKey();
    _resetSigningKeyCache();
    _resetTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips cuando el usuario no tiene LtiSession', async () => {
    const user = await prisma.user.create({
      data: { email: 'noLti@test.local', emailVerified: true },
    });
    const outcome = await submitScoreForUser({
      userId: user.id,
      score: 80,
      gradingProgress: 'FullyGraded',
    });
    expect(outcome.status).toBe('skipped');
  });

  it('skips cuando el launch no incluyó AGS endpoint', async () => {
    const { user } = await seedPlatformAndUser({ agsLineitemUrl: null, agsScopes: [] });
    const outcome = await submitScoreForUser({
      userId: user.id,
      score: 80,
      gradingProgress: 'FullyGraded',
    });
    expect(outcome.status).toBe('skipped');
  });

  it('skips cuando la plataforma no concede scope de score', async () => {
    const { user } = await seedPlatformAndUser({
      agsLineitemUrl: 'https://moodle.test/mod/lti/services.php/2/lineitems/1/lineitem',
      agsScopes: ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'],
    });
    const outcome = await submitScoreForUser({
      userId: user.id,
      score: 80,
      gradingProgress: 'FullyGraded',
    });
    expect(outcome.status).toBe('skipped');
  });

  it('hace POST al lineitem con el body AGS correcto', async () => {
    const lineitemUrl = 'https://moodle.test/mod/lti/services.php/2/lineitems/9/lineitem?type_id=4';
    const { user, ltiSession } = await seedPlatformAndUser({
      agsLineitemUrl: lineitemUrl,
      agsScopes: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'],
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === PLATFORM.tokenEndpoint) {
        return new Response(
          JSON.stringify({ access_token: 'mocked-token', expires_in: 3600, token_type: 'Bearer' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/lineitems/9/lineitem')) {
        return new Response('', { status: 200 });
      }
      return new Response(`unexpected ${url}`, { status: 500 });
    });

    const outcome = await submitScoreForUser({
      userId: user.id,
      score: 87,
      feedback: 'good closing',
      gradingProgress: 'FullyGraded',
    });

    expect(outcome.status).toBe('submitted');

    const scoresCall = fetchSpy.mock.calls.find(([u]) => {
      const url = typeof u === 'string' ? u : (u as Request).url;
      return url.includes('/scores');
    });
    expect(scoresCall).toBeDefined();
    const init = scoresCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/vnd.ims.lis.v1.score+json',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer mocked-token');

    const body = JSON.parse(init.body as string);
    expect(body.userId).toBe(ltiSession.ltiUserId);
    expect(body.scoreGiven).toBe(87);
    expect(body.scoreMaximum).toBe(100);
    expect(body.activityProgress).toBe('Completed');
    expect(body.gradingProgress).toBe('FullyGraded');
    expect(body.comment).toBe('good closing');
    expect(typeof body.timestamp).toBe('string');

    // Scores URL should preserve query string (?type_id=4) and append /scores
    // before it.
    const scoresUrl =
      typeof scoresCall![0] === 'string' ? scoresCall![0] : (scoresCall![0] as Request).url;
    expect(scoresUrl).toBe(
      'https://moodle.test/mod/lti/services.php/2/lineitems/9/lineitem/scores?type_id=4',
    );
  });

  it('falla con outcome=failed cuando el platform devuelve 4xx en /scores', async () => {
    const lineitemUrl = 'https://moodle.test/mod/lti/services.php/2/lineitems/9/lineitem';
    const { user } = await seedPlatformAndUser({
      agsLineitemUrl: lineitemUrl,
      agsScopes: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'],
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === PLATFORM.tokenEndpoint) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('forbidden', { status: 403 });
    });

    const outcome = await submitScoreForUser({
      userId: user.id,
      score: 80,
      gradingProgress: 'FullyGraded',
    });
    expect(outcome.status).toBe('failed');
  });
});
