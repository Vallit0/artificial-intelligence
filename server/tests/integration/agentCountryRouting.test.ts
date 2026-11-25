// ============================================
// Enrutamiento de agentes ElevenLabs por país
// ============================================
//
// Un usuario cuya sede es de México debe conectarse al agente `<SECRET>_MX`
// si está configurado; si no, al agente base. Los overrides de prompt se
// buscan por el secret name EFECTIVO (no se hereda el prompt del base al
// agente de MX). El fetch a ElevenLabs se stubbea para capturar el agent_id.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

const PASSWORD = 'supersecret-abc';
const SECRET = 'ELEVENLABS_AGENT_COACH';

async function seedSede(slug: string, country: string | null) {
  return prisma.sede.create({ data: { slug, name: slug.toUpperCase(), country } });
}

async function seedLearner(email: string, sedeId: string | null) {
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      emailVerified: true,
      status: 'approved',
      sedeId,
      roles: { create: { role: 'learner' } },
    },
  });
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

async function seedAgent(secretName: string, agentId: string) {
  await prisma.agentConfig.create({ data: { secretName, agentId } });
}

// Captura el agent_id que el server le pide a ElevenLabs.
function stubElevenLabs() {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const agentId = url.searchParams.get('agent_id') ?? '';
    calls.push(agentId);
    return new Response(JSON.stringify({ signed_url: `wss://signed.test/${agentId}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

async function token(accessToken: string | null, body: Record<string, unknown>) {
  let req = request(app).post('/api/elevenlabs/conversation-token');
  if (accessToken) req = req.set('Authorization', `Bearer ${accessToken}`);
  return req.send(body);
}

describe('Enrutamiento de agentes por país', () => {
  // Agent IDs únicos por test: el cache de signed URL del service es por
  // agentId y vive en memoria del proceso entre tests.
  let n = 0;
  const uid = (s: string) => `${s}_${Date.now()}_${++n}`;

  beforeEach(async () => {
    await resetDatabase();
    await seedAgent('ELEVENLABS_API_KEY', 'xi-test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usuario de México va al agente _MX; usuario de Guatemala al base', async () => {
    const gtAgent = uid('agent_gt');
    const mxAgent = uid('agent_mx');
    await seedAgent(SECRET, gtAgent);
    await seedAgent(`${SECRET}_MX`, mxAgent);

    const gt = await seedSede('gt', 'GT');
    const mx = await seedSede('mx', 'MX');
    const gtToken = await seedLearner('gt@route.test', gt.id);
    const mxToken = await seedLearner('mx@route.test', mx.id);

    const calls = stubElevenLabs();

    const resMx = await token(mxToken, { agentSecretName: SECRET });
    expect(resMx.status).toBe(200);
    expect(resMx.body.signedUrl).toBe(`wss://signed.test/${mxAgent}`);
    expect(resMx.body.routing).toMatchObject({
      country: 'MX',
      agentSecretName: SECRET,
      effectiveSecretName: `${SECRET}_MX`,
      countryRouted: true,
    });

    const resGt = await token(gtToken, { agentSecretName: SECRET });
    expect(resGt.status).toBe(200);
    expect(resGt.body.signedUrl).toBe(`wss://signed.test/${gtAgent}`);
    expect(resGt.body.routing).toMatchObject({
      country: 'GT',
      effectiveSecretName: SECRET,
      countryRouted: false,
    });

    expect(calls).toEqual([mxAgent, gtAgent]);
  });

  it('México sin agente _MX configurado cae al agente base', async () => {
    const baseAgent = uid('agent_base');
    await seedAgent(SECRET, baseAgent);
    const mx = await seedSede('mx', 'MX');
    const mxToken = await seedLearner('mx2@route.test', mx.id);
    const calls = stubElevenLabs();

    const res = await token(mxToken, { agentSecretName: SECRET });
    expect(res.status).toBe(200);
    expect(res.body.signedUrl).toBe(`wss://signed.test/${baseAgent}`);
    expect(res.body.routing).toMatchObject({ country: 'MX', effectiveSecretName: SECRET, countryRouted: false });
    expect(calls).toEqual([baseAgent]);
  });

  it('sede sin país y anónimo usan el agente base', async () => {
    const baseAgent = uid('agent_base');
    const mxAgent = uid('agent_mx');
    await seedAgent(SECRET, baseAgent);
    await seedAgent(`${SECRET}_MX`, mxAgent);
    const sinPais = await seedSede('sinpais', null);
    const t = await seedLearner('nopais@route.test', sinPais.id);
    const calls = stubElevenLabs();

    const r1 = await token(t, { agentSecretName: SECRET });
    expect(r1.status).toBe(200);
    expect(r1.body.routing).toMatchObject({ country: null, countryRouted: false });

    const r2 = await token(null, { agentSecretName: SECRET });
    expect(r2.status).toBe(200);
    expect(r2.body.routing).toMatchObject({ country: null, countryRouted: false });

    expect(calls).toEqual([baseAgent]); // la 2da va por cache del mismo agentId
  });

  it('el override de prompt NO se hereda del base al agente de México', async () => {
    const gtAgent = uid('agent_gt');
    const mxAgent = uid('agent_mx');
    await seedAgent(SECRET, gtAgent);
    await seedAgent(`${SECRET}_MX`, mxAgent);
    await prisma.prospectingScenarioConfig.create({
      data: { secretName: SECRET, systemPrompt: 'Prompt chapín', firstMessage: 'Buenas, ¿qué tal?' },
    });
    await prisma.prospectingScenarioConfig.create({
      data: { secretName: `${SECRET}_MX`, systemPrompt: 'Prompt mexicano' },
    });

    const gt = await seedSede('gt', 'GT');
    const mx = await seedSede('mx', 'MX');
    const gtToken = await seedLearner('gt3@route.test', gt.id);
    const mxToken = await seedLearner('mx3@route.test', mx.id);
    stubElevenLabs();

    const resGt = await token(gtToken, { agentSecretName: SECRET });
    expect(resGt.body.overrides).toEqual({ prompt: 'Prompt chapín', firstMessage: 'Buenas, ¿qué tal?' });

    const resMx = await token(mxToken, { agentSecretName: SECRET });
    expect(resMx.body.overrides).toEqual({ prompt: 'Prompt mexicano', firstMessage: undefined });
  });
});
