// ============================================
// GET /api/admin/analytics/time-by-mode
// ============================================
//
// Cubre el desglose de tiempo por modo:
//   1. Taxonomía: cliente + prospección suman a la familia Cliente (Nivel 1).
//   2. Alcance: admin global ve a todos los learners; un coach ve SÓLO sus
//      alumnos asignados (user.coachId === coach.id).

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

interface SeedUserOpts {
  email: string;
  password?: string;
  role?: 'admin' | 'learner' | 'coach' | 'instructor';
  sedeId: string;
  coachId?: string;
}

async function seedUser(opts: SeedUserOpts) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId: opts.sedeId,
      coachId: opts.coachId ?? null,
      roles: { create: { role: opts.role ?? 'learner' } },
    },
  });
  if (opts.role === 'coach') {
    await prisma.coachPermission.create({
      data: { userId: user.id, canCreateCoaches: false, canEditPrompts: false },
    });
  }
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

function seedSession(
  userId: string,
  durationSeconds: number,
  opts: { practiceMode?: string | null; examType?: string | null } = {},
) {
  return prisma.practiceSession.create({
    data: {
      userId,
      durationSeconds,
      practiceMode: opts.practiceMode ?? null,
      examType: opts.examType ?? null,
    },
  });
}

describe('GET /api/admin/analytics/time-by-mode', () => {
  let sedeA: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let learnerAsignado: { id: string; email: string; password: string };
  let learnerOtro: { id: string; email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    admin = await seedUser({ email: 'admin@tbm.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach@tbm.test', role: 'coach', sedeId: sedeA.id });
    learnerAsignado = await seedUser({
      email: 'asignado@tbm.test',
      role: 'learner',
      sedeId: sedeA.id,
      coachId: coachA.id,
    });
    learnerOtro = await seedUser({ email: 'otro@tbm.test', role: 'learner', sedeId: sedeA.id });
  });

  it('admin global ve el desglose agregado con la taxonomía correcta', async () => {
    await seedSession(learnerAsignado.id, 60, { practiceMode: 'cliente' });
    await seedSession(learnerAsignado.id, 30, { practiceMode: 'cliente_prospeccion' });
    await seedSession(learnerOtro.id, 20, { practiceMode: 'objeciones' });
    await seedSession(learnerOtro.id, 15, {}); // sin clasificar

    const token = await loginAs(admin.email, admin.password);
    const res = await request(app)
      .get('/api/admin/analytics/time-by-mode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const t = res.body.totals;
    expect(t.roleplayClienteSeconds).toBe(90); // 60 + 30
    expect(t.prospeccionSeconds).toBe(30);
    expect(t.roleplayObjecionesSeconds).toBe(20);
    expect(t.sinClasificarSeconds).toBe(15);
    expect(t.totalSeconds).toBe(125);
    expect(res.body.byStudent).toHaveLength(2);
  });

  it('un coach ve SÓLO sus alumnos asignados', async () => {
    await seedSession(learnerAsignado.id, 100, { practiceMode: 'cliente' });
    await seedSession(learnerOtro.id, 999, { practiceMode: 'cliente' });

    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .get('/api/admin/analytics/time-by-mode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totals.roleplayClienteSeconds).toBe(100); // sólo el asignado
    expect(res.body.byStudent).toHaveLength(1);
    expect(res.body.byStudent[0].id).toBe(learnerAsignado.id);
  });

  it('rechaza a un learner (no admin/coach) — 403', async () => {
    const token = await loginAs(learnerAsignado.email, learnerAsignado.password);
    const res = await request(app)
      .get('/api/admin/analytics/time-by-mode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
