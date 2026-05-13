import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { ensureToolKey, getPublicJwks, _resetSigningKeyCache } from '../../src/services/toolKey.service.js';
import {
  isDeepLinkingRequest,
  extractDeepLinkingSettings,
  signDeepLinkingResponse,
} from '../../src/services/deepLinking.service.js';

const PLATFORM = {
  name: 'Test Moodle',
  issuerUrl: 'https://moodle.test',
  clientId: 'test-client-id',
  authEndpoint: 'https://moodle.test/mod/lti/auth.php',
  tokenEndpoint: 'https://moodle.test/mod/lti/token.php',
  jwksUrl: 'https://moodle.test/mod/lti/certs.php',
  deploymentId: 'dep-1',
};

const DL_RETURN_URL = 'https://moodle.test/mod/lti/contentitem_return.php';

const CLAIM = {
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  DEEP_LINKING_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  CONTENT_ITEMS: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  DATA: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
} as const;

// ============================================
// Pure service-level tests
// ============================================

describe('deepLinking.service — pure helpers', () => {
  it('isDeepLinkingRequest detecta el message_type correcto', () => {
    expect(isDeepLinkingRequest({ [CLAIM.MESSAGE_TYPE]: 'LtiDeepLinkingRequest' })).toBe(true);
    expect(isDeepLinkingRequest({ [CLAIM.MESSAGE_TYPE]: 'LtiResourceLinkRequest' })).toBe(false);
    expect(isDeepLinkingRequest({})).toBe(false);
  });

  it('extractDeepLinkingSettings devuelve null si falta deep_link_return_url', () => {
    expect(extractDeepLinkingSettings({})).toBeNull();
    expect(
      extractDeepLinkingSettings({
        [CLAIM.DEEP_LINKING_SETTINGS]: { accept_types: ['ltiResourceLink'] },
      }),
    ).toBeNull();
  });

  it('extractDeepLinkingSettings devuelve settings cuando deep_link_return_url está presente', () => {
    const settings = extractDeepLinkingSettings({
      [CLAIM.DEEP_LINKING_SETTINGS]: {
        deep_link_return_url: DL_RETURN_URL,
        accept_types: ['ltiResourceLink'],
        accept_multiple: true,
        data: 'opaque-data-from-platform',
      },
    });
    expect(settings).not.toBeNull();
    expect(settings!.deep_link_return_url).toBe(DL_RETURN_URL);
    expect(settings!.accept_multiple).toBe(true);
    expect(settings!.data).toBe('opaque-data-from-platform');
  });
});

// ============================================
// signDeepLinkingResponse — verifies the signed JWT is valid against
// the tool's public JWK and carries the expected claims.
// ============================================

describe('signDeepLinkingResponse', () => {
  beforeEach(async () => {
    await resetDatabase();
    _resetSigningKeyCache();
    await ensureToolKey();
  });

  it('firma un JWT verificable con la JWK pública del tool', async () => {
    const token = await signDeepLinkingResponse({
      platformClientId: PLATFORM.clientId,
      platformIssuerUrl: PLATFORM.issuerUrl,
      deploymentId: PLATFORM.deploymentId,
      data: 'echo-me',
      items: [
        {
          scenarioId: 'scenario-uuid-1',
          title: 'Pareja Discutiendo',
          description: 'Negocia con una pareja',
          launchUrl: 'https://app.test/lti/launch',
        },
      ],
    });

    const { keys } = await getPublicJwks();
    const publicKey = crypto.createPublicKey({ key: keys[0] as crypto.JsonWebKey, format: 'jwk' });
    const verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

    expect(verified.iss).toBe(PLATFORM.clientId);
    expect(verified.aud).toBe(PLATFORM.issuerUrl);
    expect(verified.sub).toBe(PLATFORM.clientId);
    expect(verified[CLAIM.MESSAGE_TYPE]).toBe('LtiDeepLinkingResponse');
    expect(verified[CLAIM.VERSION]).toBe('1.3.0');
    expect(verified[CLAIM.DEPLOYMENT_ID]).toBe(PLATFORM.deploymentId);
    expect(verified[CLAIM.DATA]).toBe('echo-me');

    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('ltiResourceLink');
    expect(items[0].title).toBe('Pareja Discutiendo');
    expect(items[0].url).toBe('https://app.test/lti/launch');
    expect(items[0].custom).toEqual({ scenarioId: 'scenario-uuid-1' });
  });

  it('omite custom.scenarioId cuando scenarioId es null (link al menú)', async () => {
    const token = await signDeepLinkingResponse({
      platformClientId: PLATFORM.clientId,
      platformIssuerUrl: PLATFORM.issuerUrl,
      deploymentId: PLATFORM.deploymentId,
      data: null,
      items: [
        { scenarioId: null, title: 'Menú', launchUrl: 'https://app.test/lti/launch' },
      ],
    });

    const { keys } = await getPublicJwks();
    const publicKey = crypto.createPublicKey({ key: keys[0] as crypto.JsonWebKey, format: 'jwk' });
    const verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;

    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    expect(items[0].custom).toEqual({});
  });

  it('no incluye claim data cuando es null', async () => {
    const token = await signDeepLinkingResponse({
      platformClientId: PLATFORM.clientId,
      platformIssuerUrl: PLATFORM.issuerUrl,
      deploymentId: PLATFORM.deploymentId,
      data: null,
      items: [],
    });

    const { keys } = await getPublicJwks();
    const publicKey = crypto.createPublicKey({ key: keys[0] as crypto.JsonWebKey, format: 'jwk' });
    const verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;
    expect(verified[CLAIM.DATA]).toBeUndefined();
  });
});

// ============================================
// GET /lti/deep-linking/state/:id — picker bootstrap endpoint
// ============================================

async function seedPlatform() {
  return prisma.ltiPlatform.create({ data: PLATFORM });
}

async function seedScenarios() {
  return prisma.$transaction([
    prisma.scenario.create({
      data: {
        name: 'Escenario A',
        description: 'desc A',
        objection: 'precio',
        clientPersona: 'persona A',
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.scenario.create({
      data: {
        name: 'Escenario B',
        description: 'desc B',
        objection: 'tiempo',
        clientPersona: 'persona B',
        displayOrder: 2,
        isActive: true,
      },
    }),
    prisma.scenario.create({
      data: {
        name: 'Inactivo',
        objection: 'x',
        clientPersona: 'x',
        displayOrder: 99,
        isActive: false,
      },
    }),
  ]);
}

describe('GET /lti/deep-linking/state/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
    _resetSigningKeyCache();
    await ensureToolKey();
  });

  it('404 cuando el state no existe', async () => {
    const res = await request(app).get(`/lti/deep-linking/state/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('410 cuando el state ya fue consumido', async () => {
    const platform = await seedPlatform();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        consumedAt: new Date(),
      },
    });
    const res = await request(app).get(`/lti/deep-linking/state/${state.id}`);
    expect(res.status).toBe(410);
  });

  it('410 cuando el state expiró', async () => {
    const platform = await seedPlatform();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await request(app).get(`/lti/deep-linking/state/${state.id}`);
    expect(res.status).toBe(410);
  });

  it('200 con plataforma + escenarios activos ordenados por displayOrder', async () => {
    const platform = await seedPlatform();
    await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        contextTitle: 'Ventas 101',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app).get(`/lti/deep-linking/state/${state.id}`);
    expect(res.status).toBe(200);
    expect(res.body.stateId).toBe(state.id);
    expect(res.body.platformName).toBe(PLATFORM.name);
    expect(res.body.contextTitle).toBe('Ventas 101');
    expect(res.body.scenarios).toHaveLength(2);
    expect(res.body.scenarios[0].displayOrder).toBe(1);
    expect(res.body.scenarios[1].displayOrder).toBe(2);
    expect(res.body.scenarios.find((s: { name: string }) => s.name === 'Inactivo')).toBeUndefined();
  });
});

// ============================================
// POST /lti/deep-linking/submit
// ============================================

describe('POST /lti/deep-linking/submit', () => {
  beforeEach(async () => {
    await resetDatabase();
    _resetSigningKeyCache();
    await ensureToolKey();
  });

  it('400 cuando stateId no es uuid válido', async () => {
    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: 'not-a-uuid', scenarioIds: [] });
    expect(res.status).toBe(400);
  });

  it('404 cuando el state no existe', async () => {
    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: crypto.randomUUID(), scenarioIds: [] });
    expect(res.status).toBe(404);
  });

  it('410 cuando el state ya fue consumido', async () => {
    const platform = await seedPlatform();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        consumedAt: new Date(),
      },
    });
    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [] });
    expect(res.status).toBe(410);
  });

  it('410 cuando el state expiró', async () => {
    const platform = await seedPlatform();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [] });
    expect(res.status).toBe(410);
  });

  async function extractJwtFromHtml(html: string): Promise<string> {
    const match = html.match(/name="JWT"\s+value="([^"]+)"/);
    if (!match) throw new Error('JWT input not found in auto-submit form');
    // The form uses HTML-escaped attrs. The JWT base64url contains only safe
    // chars, so escape only affects '&' which would have been encoded.
    return match[1].replace(/&amp;/g, '&');
  }

  async function verifyJwt(token: string): Promise<Record<string, unknown>> {
    const { keys } = await getPublicJwks();
    const publicKey = crypto.createPublicKey({ key: keys[0] as crypto.JsonWebKey, format: 'jwk' });
    return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;
  }

  it('200 con auto-submit form y marca state consumed', async () => {
    const platform = await seedPlatform();
    const [scenarioA] = await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        data: 'opaque-from-platform',
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [scenarioA.id] });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`action="${DL_RETURN_URL}"`);
    expect(res.text).toContain('name="JWT"');

    const refreshed = await prisma.ltiDeepLinkingState.findUnique({ where: { id: state.id } });
    expect(refreshed!.consumedAt).not.toBeNull();

    const token = await extractJwtFromHtml(res.text);
    const verified = await verifyJwt(token);
    expect(verified[CLAIM.DATA]).toBe('opaque-from-platform');

    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Escenario A');
    expect(items[0].custom).toEqual({ scenarioId: scenarioA.id });
  });

  it('includeMenuLink agrega un item extra apuntando al menú', async () => {
    const platform = await seedPlatform();
    const [scenarioA] = await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [scenarioA.id], includeMenuLink: true });

    expect(res.status).toBe(200);
    const token = await extractJwtFromHtml(res.text);
    const verified = await verifyJwt(token);
    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);

    const menuItem = items.find((i) => Object.keys(i.custom as object).length === 0);
    const scenarioItem = items.find((i) => (i.custom as { scenarioId?: string }).scenarioId === scenarioA.id);
    expect(menuItem).toBeDefined();
    expect(scenarioItem).toBeDefined();
  });

  it('scenarioIds vacío → fallback a un único link al menú', async () => {
    const platform = await seedPlatform();
    await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [] });

    expect(res.status).toBe(200);
    const token = await extractJwtFromHtml(res.text);
    const verified = await verifyJwt(token);
    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].custom).toEqual({});
  });

  it('scenarioIds inexistentes o inactivos se filtran', async () => {
    const platform = await seedPlatform();
    const [, , inactive] = await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [inactive.id, crypto.randomUUID()] });

    expect(res.status).toBe(200);
    const token = await extractJwtFromHtml(res.text);
    const verified = await verifyJwt(token);
    const items = verified[CLAIM.CONTENT_ITEMS] as Array<Record<string, unknown>>;
    // No valid scenarios passed → fallback menu link injected, items length 1.
    expect(items).toHaveLength(1);
    expect(items[0].custom).toEqual({});
  });

  it('un segundo submit del mismo state es rechazado con 410', async () => {
    const platform = await seedPlatform();
    const [scenarioA] = await seedScenarios();
    const state = await prisma.ltiDeepLinkingState.create({
      data: {
        platformId: platform.id,
        deploymentId: PLATFORM.deploymentId,
        returnUrl: DL_RETURN_URL,
        ltiUserId: 'lti-teacher',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res1 = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [scenarioA.id] });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/lti/deep-linking/submit')
      .send({ stateId: state.id, scenarioIds: [scenarioA.id] });
    expect(res2.status).toBe(410);
  });
});

// ============================================
// /lti/launch full flow — Deep Linking branch
// ============================================
// Simulates Moodle signing an id_token with its own keypair and POSTing it
// back to /lti/launch with the state we issued at /initiate. The tool must
// verify the JWT against the mocked JWKS and create a LtiDeepLinkingState,
// then redirect to the picker URL.

function generatePlatformKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  return { publicKey, privateKey };
}

function mockJwks(publicKey: crypto.KeyObject, kid: string) {
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === PLATFORM.jwksUrl) {
      return new Response(
        JSON.stringify({
          keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(`unexpected ${url}`, { status: 500 });
  });
}

async function seedLaunchState(platformId: string) {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  await prisma.ltiLaunchState.create({
    data: {
      state,
      nonce,
      platformId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { state, nonce };
}

describe('POST /lti/launch — LtiDeepLinkingRequest branch', () => {
  beforeEach(async () => {
    await resetDatabase();
    _resetSigningKeyCache();
    await ensureToolKey();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crea LtiDeepLinkingState y redirige al picker', async () => {
    const platform = await prisma.ltiPlatform.create({ data: PLATFORM });
    const { state, nonce } = await seedLaunchState(platform.id);
    const { publicKey, privateKey } = generatePlatformKeypair();
    const kid = 'platform-kid-1';
    mockJwks(publicKey, kid);

    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt.sign(
      {
        iss: PLATFORM.issuerUrl,
        aud: PLATFORM.clientId,
        sub: 'lti-teacher-sub',
        nonce,
        iat: now,
        exp: now + 600,
        [CLAIM.MESSAGE_TYPE]: 'LtiDeepLinkingRequest',
        [CLAIM.VERSION]: '1.3.0',
        [CLAIM.DEPLOYMENT_ID]: PLATFORM.deploymentId,
        [CLAIM.DEEP_LINKING_SETTINGS]: {
          deep_link_return_url: DL_RETURN_URL,
          accept_types: ['ltiResourceLink'],
          accept_multiple: true,
          data: 'opaque-data',
        },
        [CLAIM.CONTEXT]: { id: 'ctx-1', title: 'Ventas Avanzadas' },
      },
      privateKey,
      { algorithm: 'RS256', keyid: kid },
    );

    const res = await request(app)
      .post('/lti/launch')
      .send({ id_token: idToken, state });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/lti\/deep-linking\/select\?state=/);

    const dlStates = await prisma.ltiDeepLinkingState.findMany();
    expect(dlStates).toHaveLength(1);
    expect(dlStates[0].platformId).toBe(platform.id);
    expect(dlStates[0].deploymentId).toBe(PLATFORM.deploymentId);
    expect(dlStates[0].returnUrl).toBe(DL_RETURN_URL);
    expect(dlStates[0].data).toBe('opaque-data');
    expect(dlStates[0].ltiUserId).toBe('lti-teacher-sub');
    expect(dlStates[0].contextId).toBe('ctx-1');
    expect(dlStates[0].contextTitle).toBe('Ventas Avanzadas');
  });

  it('400 cuando el id_token no incluye deep_linking_settings', async () => {
    const platform = await prisma.ltiPlatform.create({ data: PLATFORM });
    const { state, nonce } = await seedLaunchState(platform.id);
    const { publicKey, privateKey } = generatePlatformKeypair();
    const kid = 'platform-kid-2';
    mockJwks(publicKey, kid);

    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt.sign(
      {
        iss: PLATFORM.issuerUrl,
        aud: PLATFORM.clientId,
        sub: 'lti-teacher-sub',
        nonce,
        iat: now,
        exp: now + 600,
        [CLAIM.MESSAGE_TYPE]: 'LtiDeepLinkingRequest',
        [CLAIM.VERSION]: '1.3.0',
        [CLAIM.DEPLOYMENT_ID]: PLATFORM.deploymentId,
        // deep_linking_settings missing on purpose
      },
      privateKey,
      { algorithm: 'RS256', keyid: kid },
    );

    const res = await request(app)
      .post('/lti/launch')
      .send({ id_token: idToken, state });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/deep linking settings/i);
  });

  it('400 cuando falta claim sub en DeepLinkingRequest', async () => {
    const platform = await prisma.ltiPlatform.create({ data: PLATFORM });
    const { state, nonce } = await seedLaunchState(platform.id);
    const { publicKey, privateKey } = generatePlatformKeypair();
    const kid = 'platform-kid-3';
    mockJwks(publicKey, kid);

    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt.sign(
      {
        iss: PLATFORM.issuerUrl,
        aud: PLATFORM.clientId,
        // sub omitido a propósito
        nonce,
        iat: now,
        exp: now + 600,
        [CLAIM.MESSAGE_TYPE]: 'LtiDeepLinkingRequest',
        [CLAIM.VERSION]: '1.3.0',
        [CLAIM.DEPLOYMENT_ID]: PLATFORM.deploymentId,
        [CLAIM.DEEP_LINKING_SETTINGS]: {
          deep_link_return_url: DL_RETURN_URL,
          accept_types: ['ltiResourceLink'],
        },
      },
      privateKey,
      { algorithm: 'RS256', keyid: kid },
    );

    const res = await request(app)
      .post('/lti/launch')
      .send({ id_token: idToken, state });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sub/i);
  });
});
