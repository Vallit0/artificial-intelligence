import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';

async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

async function seedUser(opts: {
  email: string;
  password?: string;
  role?: 'admin' | 'learner' | 'coach' | 'instructor';
  sedeId: string;
  firstName?: string;
  lastName?: string;
}) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId: opts.sedeId,
      firstName: opts.firstName,
      lastName: opts.lastName,
      roles: { create: { role: opts.role ?? 'learner' } },
    },
  });
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

async function seedDefaultRates() {
  await prisma.pricingRate.createMany({
    data: [
      { service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.10' },
      { service: 'infra', unit: 'monthly', unitPriceUsd: '120' },
    ],
  });
}

describe('Cost analytics', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let admin: { email: string; password: string };
  let coachA: { email: string; password: string };
  let learnerA: { id: string };
  let learnerB: { id: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    sedeB = await createSede('sede-b', 'Sede B');
    admin = await seedUser({ email: 'admin@costs.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@costs.test', role: 'coach', sedeId: sedeA.id });
    const lA = await seedUser({ email: 'learner-a@costs.test', role: 'learner', sedeId: sedeA.id, firstName: 'Ana', lastName: 'A' });
    const lB = await seedUser({ email: 'learner-b@costs.test', role: 'learner', sedeId: sedeB.id, firstName: 'Bruno', lastName: 'B' });
    learnerA = { id: lA.id };
    learnerB = { id: lB.id };

    const scenario = await prisma.scenario.create({
      data: { name: 'Esc 1', objection: 'No me interesa', clientPersona: 'p' },
    });

    // Sesión en sede A: 5 min
    await prisma.practiceSession.create({
      data: { userId: learnerA.id, scenarioId: scenario.id, durationSeconds: 300, score: 80 },
    });
    // Sesión en sede A: 10 min
    await prisma.practiceSession.create({
      data: { userId: learnerA.id, scenarioId: scenario.id, durationSeconds: 600, score: 90 },
    });
    // Sesión en sede B: 2 min
    await prisma.practiceSession.create({
      data: { userId: learnerB.id, scenarioId: scenario.id, durationSeconds: 120, score: 70 },
    });
  });

  it('GET /api/admin/analytics/costs: sin tarifas configuradas devuelve total 0', async () => {
    const token = await loginAs(admin.email, admin.password);
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from, to, groupBy: 'sede' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.totalCostUsd).toBe(0);
    expect(res.body.appliedRates.elevenlabsPerMinuteUsd).toBeNull();
    expect(res.body.openaiCostTracked).toBe(false);
  });

  it('GET /api/admin/analytics/costs: admin global ve costos de ambas sedes', async () => {
    await seedDefaultRates();
    const token = await loginAs(admin.email, admin.password);
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from, to, groupBy: 'sede' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toBe(3);
    expect(res.body.minutes).toBeCloseTo(17, 2); // 5 + 10 + 2
    // ElevenLabs: 17 min * 0.10 = 1.70 USD
    expect(res.body.totals.elevenlabsCostUsd).toBeCloseTo(1.7, 2);
    expect(res.body.breakdown.length).toBe(2); // dos sedes
  });

  it('GET /api/admin/analytics/costs: coach ve sólo su sede', async () => {
    await seedDefaultRates();
    const token = await loginAs(coachA.email, coachA.password);
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from, to, groupBy: 'sede' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toBe(2); // sólo learner A
    expect(res.body.minutes).toBeCloseTo(15, 2);
    expect(res.body.totals.elevenlabsCostUsd).toBeCloseTo(1.5, 2);
  });

  it('GET /api/admin/analytics/costs: groupBy=user devuelve top-N usuarios', async () => {
    await seedDefaultRates();
    const token = await loginAs(admin.email, admin.password);
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from, to, groupBy: 'user', limit: 10 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.breakdown[0].label).toBe('Ana A');
    expect(res.body.breakdown[0].minutes).toBeCloseTo(15, 2);
    expect(res.body.breakdown[1].minutes).toBeCloseTo(2, 2);
  });

  it('GET /api/admin/analytics/costs: 400 si from >= to', async () => {
    const token = await loginAs(admin.email, admin.password);
    const t = new Date().toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from: t, to: t, groupBy: 'sede' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/analytics/costs: 403 si no está autenticado', async () => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await request(app)
      .get('/api/admin/analytics/costs')
      .query({ from, to, groupBy: 'sede' });
    expect(res.status).toBe(401);
  });
});

describe('Pricing rates CRUD', () => {
  let sedeA: { id: string };
  let admin: { email: string; password: string };
  let coach: { email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    admin = await seedUser({ email: 'admin@pricing.test', role: 'admin', sedeId: sedeA.id });
    coach = await seedUser({ email: 'coach@pricing.test', role: 'coach', sedeId: sedeA.id });
  });

  it('POST /api/admin/pricing-rates: crea tarifa y cierra la anterior', async () => {
    const token = await loginAs(admin.email, admin.password);

    const first = await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.10' });
    expect(first.status).toBe(201);
    expect(first.body.isActive).toBe(true);

    const second = await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.12', notes: 'subida' });
    expect(second.status).toBe(201);
    expect(second.body.isActive).toBe(true);

    const previous = await prisma.pricingRate.findUnique({ where: { id: first.body.id } });
    expect(previous?.isActive).toBe(false);
    expect(previous?.effectiveTo).not.toBeNull();
  });

  it('POST /api/admin/pricing-rates: 403 para coaches', async () => {
    const token = await loginAs(coach.email, coach.password);
    const res = await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.10' });
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/pricing-rates: 400 si precio es negativo', async () => {
    const token = await loginAs(admin.email, admin.password);
    const res = await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '-1' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/admin/pricing-rates/:id: actualiza notas sin tocar precio', async () => {
    const token = await loginAs(admin.email, admin.password);
    const created = await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.10' });

    const patched = await request(app)
      .patch(`/api/admin/pricing-rates/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'verified vs invoice 2026-05' });
    expect(patched.status).toBe(200);
    expect(patched.body.notes).toBe('verified vs invoice 2026-05');
    expect(patched.body.unitPriceUsd).toBe(created.body.unitPriceUsd);
  });

  it('GET /api/admin/pricing-rates?includeHistory=true: muestra inactivas también', async () => {
    const token = await loginAs(admin.email, admin.password);
    await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.10' });
    await request(app)
      .post('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service: 'elevenlabs', unit: 'per_minute', unitPriceUsd: '0.15' });

    const active = await request(app)
      .get('/api/admin/pricing-rates')
      .set('Authorization', `Bearer ${token}`);
    expect(active.body.length).toBe(1);

    const all = await request(app)
      .get('/api/admin/pricing-rates')
      .query({ includeHistory: 'true' })
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.length).toBe(2);
  });
});
