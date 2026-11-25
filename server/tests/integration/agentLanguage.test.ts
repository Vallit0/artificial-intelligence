// ============================================
// Idioma global de los agentes (toggle admin → override de ElevenLabs)
// ============================================
//
// AppConfig.agentLanguage ('es' | 'en') viaja en la respuesta de
// POST /api/elevenlabs/conversation-token como `language`. El cliente lo
// traduce al override `overrides.agent.language = "en"` al iniciar la sesión.
// 'es' es el default y NO genera override (comportamiento histórico).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

const PASSWORD = 'supersecret-abc';
const SECRET = 'ELEVENLABS_AGENT_COACH';

async function seedUser(email: string, role: 'learner' | 'admin') {
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      emailVerified: true,
      status: 'approved',
      roles: { create: { role } },
    },
  });
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

function stubElevenLabs() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      const agentId = url.searchParams.get('agent_id') ?? '';
      return new Response(JSON.stringify({ signed_url: `wss://signed.test/${agentId}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

async function token(accessToken: string) {
  return request(app)
    .post('/api/elevenlabs/conversation-token')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ agentSecretName: SECRET });
}

describe('Idioma global de los agentes', () => {
  let n = 0;
  const uid = (s: string) => `${s}_${Date.now()}_${++n}`;

  beforeEach(async () => {
    await resetDatabase();
    await prisma.agentConfig.create({ data: { secretName: 'ELEVENLABS_API_KEY', agentId: 'xi-test-key' } });
    await prisma.agentConfig.create({ data: { secretName: SECRET, agentId: uid('agent') } });
    stubElevenLabs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("por defecto el token sale con language='es'", async () => {
    const learner = await seedUser('l1@lang.test', 'learner');
    const res = await token(learner);
    expect(res.status).toBe(200);
    expect(res.body.language).toBe('es');

    const cfg = await request(app).get('/api/config').set('Authorization', `Bearer ${learner}`);
    expect(cfg.status).toBe(200);
    expect(cfg.body.agentLanguage).toBe('es');
  });

  it("admin activa inglés → el token sale con language='en' para todos", async () => {
    const admin = await seedUser('a@lang.test', 'admin');
    const learner = await seedUser('l2@lang.test', 'learner');

    const put = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${admin}`)
      .send({ agentLanguage: 'en' });
    expect(put.status).toBe(200);
    expect(put.body.config.agentLanguage).toBe('en');

    const res = await token(learner);
    expect(res.status).toBe(200);
    expect(res.body.language).toBe('en');

    // Volver a español restaura el default.
    await request(app).put('/api/admin/config').set('Authorization', `Bearer ${admin}`).send({ agentLanguage: 'es' });
    const back = await token(learner);
    expect(back.body.language).toBe('es');
  });

  it('un idioma no soportado se ignora (no cambia la config)', async () => {
    const admin = await seedUser('a2@lang.test', 'admin');
    await request(app).put('/api/admin/config').set('Authorization', `Bearer ${admin}`).send({ agentLanguage: 'en' });

    const bad = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${admin}`)
      .send({ agentLanguage: 'fr' });
    expect(bad.status).toBe(200);
    expect(bad.body.config.agentLanguage).toBe('en');
  });

  it('un learner no puede cambiar el idioma', async () => {
    const learner = await seedUser('l3@lang.test', 'learner');
    const res = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${learner}`)
      .send({ agentLanguage: 'en' });
    expect(res.status).toBe(403);
  });
});
