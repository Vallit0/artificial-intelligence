// ============================================
// Coach assignment — PATCH /api/admin/users/:id/coach
// ============================================
//
// Cubre la asignación de coach a un estudiante (feature: coach asignado
// visible en el navbar). Reglas:
//   1. Sólo admin global asigna (coach recibe 403).
//   2. El coach debe pertenecer a la MISMA sede que el learner (aislamiento).
//   3. El target coachId debe tener rol coach.
//   4. coachId=null desasigna.
//   5. /auth/me del learner refleja sede + coach.

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
}

async function seedUser(opts: SeedUserOpts) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      sedeId: opts.sedeId,
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

describe('PATCH /api/admin/users/:id/coach', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let coachB: { id: string; email: string; password: string };
  let learnerA: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    sedeB = await createSede('sede-b', 'Sede B');
    admin = await seedUser({ email: 'admin@ca.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@ca.test', role: 'coach', sedeId: sedeA.id });
    coachB = await seedUser({ email: 'coach-b@ca.test', role: 'coach', sedeId: sedeB.id });
    learnerA = await seedUser({ email: 'learner-a@ca.test', role: 'learner', sedeId: sedeA.id });
    adminToken = await loginAs(admin.email, admin.password);
  });

  it('admin asigna un coach de la misma sede', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachA.id });

    expect(res.status).toBe(200);
    expect(res.body.coachId).toBe(coachA.id);

    const refreshed = await prisma.user.findUnique({
      where: { id: learnerA.id },
      select: { coachId: true },
    });
    expect(refreshed?.coachId).toBe(coachA.id);
  });

  it('admin desasigna con coachId=null', async () => {
    await prisma.user.update({ where: { id: learnerA.id }, data: { coachId: coachA.id } });

    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: null });

    expect(res.status).toBe(200);
    expect(res.body.coachId).toBeNull();

    const refreshed = await prisma.user.findUnique({
      where: { id: learnerA.id },
      select: { coachId: true },
    });
    expect(refreshed?.coachId).toBeNull();
  });

  it('rechaza un coach de OTRA sede (aislamiento)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachB.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/misma sede/i);
  });

  it('rechaza un coachId que no tiene rol coach', async () => {
    const otroLearner = await seedUser({ email: 'otro@ca.test', role: 'learner', sedeId: sedeA.id });
    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: otroLearner.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rol coach/i);
  });

  it('un coach (no admin global) NO puede asignar — 403', async () => {
    const coachToken = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ coachId: coachA.id });

    expect(res.status).toBe(403);
  });

  it('404 si el learner no existe', async () => {
    const res = await request(app)
      .patch('/api/admin/users/00000000-0000-0000-0000-000000000000/coach')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachA.id });

    expect(res.status).toBe(404);
  });

  it('/auth/me del learner refleja sede + coach asignado', async () => {
    await request(app)
      .patch(`/api/admin/users/${learnerA.id}/coach`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachA.id });

    const learnerToken = await loginAs(learnerA.email, learnerA.password);
    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.sede?.name).toBe('Sede A');
    expect(me.body.user.coach?.id).toBe(coachA.id);
  });
});
