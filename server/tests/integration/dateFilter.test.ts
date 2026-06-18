// ============================================
// Filtro de período (from/to) en analíticas de uso y estudiantes
// ============================================
//
// Verifica que from/to acotan las métricas derivadas de sesiones en:
//   - GET /api/admin/analytics/usage
//   - GET /api/admin/analytics/time-by-mode
//   - GET /api/admin/students
// y que sin from/to el resultado es histórico.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

async function seedUser(opts: { email: string; role?: 'admin' | 'learner'; sedeId: string }) {
  const password = 'supersecret-abc';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId: opts.sedeId,
      roles: { create: { role: opts.role ?? 'learner' } },
    },
  });
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  return res.body.accessToken;
}

function seedSessionAt(userId: string, durationSeconds: number, createdAt: Date, practiceMode = 'cliente') {
  return prisma.practiceSession.create({
    data: { userId, durationSeconds, practiceMode, createdAt },
  });
}

describe('Filtro de período (from/to)', () => {
  let sede: { id: string };
  let admin: { email: string; password: string };
  let learner: { id: string; email: string; password: string };
  let token: string;

  const ENERO = new Date('2026-01-15T12:00:00.000Z');
  const JUNIO = new Date('2026-06-15T12:00:00.000Z');

  beforeEach(async () => {
    await resetDatabase();
    sede = await createSede('sede-a', 'Sede A');
    admin = await seedUser({ email: 'admin@df.test', role: 'admin', sedeId: sede.id });
    learner = await seedUser({ email: 'learner@df.test', role: 'learner', sedeId: sede.id });
    await seedSessionAt(learner.id, 100, ENERO);
    await seedSessionAt(learner.id, 40, JUNIO);
    token = await loginAs(admin.email, admin.password);
  });

  const junioRange =
    '?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z';

  it('usage: sin rango suma todo; con rango sólo el período', async () => {
    const all = await request(app)
      .get('/api/admin/analytics/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.totals.totalTimeSeconds).toBe(140);
    expect(all.body.totals.totalSessions).toBe(2);

    const jun = await request(app)
      .get(`/api/admin/analytics/usage${junioRange}`)
      .set('Authorization', `Bearer ${token}`);
    expect(jun.status).toBe(200);
    expect(jun.body.totals.totalTimeSeconds).toBe(40);
    expect(jun.body.totals.totalSessions).toBe(1);
  });

  it('time-by-mode: el rango acota el tiempo de la familia Cliente', async () => {
    const jun = await request(app)
      .get(`/api/admin/analytics/time-by-mode${junioRange}`)
      .set('Authorization', `Bearer ${token}`);
    expect(jun.status).toBe(200);
    expect(jun.body.totals.roleplayClienteSeconds).toBe(40);
    expect(jun.body.totals.totalSeconds).toBe(40);
  });

  it('students: el rango acota sesiones/tiempo del alumno', async () => {
    const all = await request(app)
      .get('/api/admin/students')
      .set('Authorization', `Bearer ${token}`);
    const allLearner = all.body.find((s: any) => s.id === learner.id);
    expect(allLearner.totalSessions).toBe(2);
    expect(allLearner.totalDuration).toBe(140);

    const jun = await request(app)
      .get(`/api/admin/students${junioRange}`)
      .set('Authorization', `Bearer ${token}`);
    const junLearner = jun.body.find((s: any) => s.id === learner.id);
    expect(junLearner.totalSessions).toBe(1);
    expect(junLearner.totalDuration).toBe(40);
  });

  it('rechaza un from inválido con 400', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/usage?from=no-es-fecha')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
