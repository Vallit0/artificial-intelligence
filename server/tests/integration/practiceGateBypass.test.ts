// ============================================
// Gate de tiempo mínimo de práctica + bypass por-usuario (QA/testing)
// ============================================
//
// Cubre:
//   1. Con un mínimo de práctica configurado (AppConfig), un learner que no lo
//      cumplió NO puede crear una sesión de EXAMEN → 403.
//   2. Un admin puede activar `examPracticeBypass` en ese learner (PATCH
//      /api/admin/users/:id), y entonces SÍ puede rendir el examen sin práctica.
//   3. El bypass NO afecta las sesiones de práctica normales (siempre permitidas)
//      ni a otros usuarios.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

async function seedUser(email: string, role: 'admin' | 'learner', sedeId: string) {
  const password = 'supersecret-abc';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId,
      roles: { create: { role } },
    },
  });
  return { id: user.id, email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

describe('Gate de práctica + bypass por-usuario', () => {
  let sede: { id: string };
  let admin: { id: string; email: string; password: string };
  let learner: { id: string; email: string; password: string };
  let adminToken: string;
  let learnerToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sede = await prisma.sede.create({ data: { slug: 'sede-a', name: 'Sede A' } });
    admin = await seedUser('admin@gate.test', 'admin', sede.id);
    learner = await seedUser('learner@gate.test', 'learner', sede.id);
    adminToken = await loginAs(admin.email, admin.password);
    learnerToken = await loginAs(learner.email, learner.password);

    // Exige 10 min de práctica de Prospección antes de rendir el examen.
    const cfg = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minPracticeSecondsProspeccion: 600 });
    expect(cfg.status).toBe(200);
  });

  it('learner sin práctica NO puede crear sesión de examen (403)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ examType: 'prospeccion', durationSeconds: 0 });
    expect(res.status).toBe(403);
  });

  it('el bypass NO afecta las sesiones de práctica normales', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ practiceMode: 'cliente', durationSeconds: 30 });
    expect(res.status).toBe(201);
  });

  it('con examPracticeBypass el learner SÍ puede rendir el examen sin práctica', async () => {
    const patch = await request(app)
      .patch(`/api/admin/users/${learner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ examPracticeBypass: true });
    expect(patch.status).toBe(200);

    expect(
      (await prisma.user.findUnique({
        where: { id: learner.id },
        select: { examPracticeBypass: true },
      }))?.examPracticeBypass,
    ).toBe(true);

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ examType: 'prospeccion', durationSeconds: 0 });
    expect(res.status).toBe(201);
  });

  it('el bypass es por-usuario: otro learner sigue bloqueado', async () => {
    await request(app)
      .patch(`/api/admin/users/${learner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ examPracticeBypass: true });

    const otro = await seedUser('otro@gate.test', 'learner', sede.id);
    const otroToken = await loginAs(otro.email, otro.password);

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ examType: 'prospeccion', durationSeconds: 0 });
    expect(res.status).toBe(403);
  });
});
