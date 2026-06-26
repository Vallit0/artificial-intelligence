// ============================================
// Divisiones — CRUD + asignación + toggle canAccessAdmin
// ============================================
//
// Cubre la feature de Divisiones:
//   1. Admin crea divisiones; el coach debe ser de la misma sede.
//   2. Asignar un estudiante a una división sincroniza su coachId (denormalizado)
//      con el coach de la división; /auth/me refleja división + coach.
//   3. Cambiar el coach de una división re-sincroniza los learners.
//   4. Borrar una división con estudiantes → 409.
//   5. El toggle canAccessAdmin convierte a un coach en admin global (puede
//      golpear endpoints requireGlobalAdmin que un coach normal no puede).

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
  canAccessAdmin?: boolean;
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
      roles: { create: { role: opts.role ?? 'learner' } },
    },
  });
  if (opts.role === 'coach') {
    await prisma.coachPermission.create({
      data: {
        userId: user.id,
        canCreateCoaches: false,
        canEditPrompts: false,
        canAccessAdmin: opts.canAccessAdmin ?? false,
      },
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

describe('Divisiones', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let coachA2: { id: string; email: string; password: string };
  let coachB: { id: string; email: string; password: string };
  let learnerA: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    sedeB = await createSede('sede-b', 'Sede B');
    admin = await seedUser({ email: 'admin@div.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@div.test', role: 'coach', sedeId: sedeA.id });
    coachA2 = await seedUser({ email: 'coach-a2@div.test', role: 'coach', sedeId: sedeA.id });
    coachB = await seedUser({ email: 'coach-b@div.test', role: 'coach', sedeId: sedeB.id });
    learnerA = await seedUser({ email: 'learner-a@div.test', role: 'learner', sedeId: sedeA.id });
    adminToken = await loginAs(admin.email, admin.password);
  });

  async function createDivision(token: string, body: Record<string, unknown>) {
    return request(app)
      .post('/api/admin/divisions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('admin crea una división con un coach de la misma sede', async () => {
    const res = await createDivision(adminToken, {
      sedeId: sedeA.id,
      name: 'Ventas Norte',
      coachId: coachA.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ventas Norte');
    expect(res.body.coach?.id).toBe(coachA.id);
    expect(res.body.sede?.id).toBe(sedeA.id);
  });

  it('rechaza crear una división con un coach de OTRA sede', async () => {
    const res = await createDivision(adminToken, {
      sedeId: sedeA.id,
      name: 'Ventas Sur',
      coachId: coachB.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/misma sede/i);
  });

  it('rechaza nombre duplicado dentro de la misma sede (409)', async () => {
    await createDivision(adminToken, { sedeId: sedeA.id, name: 'Dup' });
    const res = await createDivision(adminToken, { sedeId: sedeA.id, name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('asignar learner a una división sincroniza su coach; /auth/me lo refleja', async () => {
    const div = (await createDivision(adminToken, {
      sedeId: sedeA.id,
      name: 'Ventas Norte',
      coachId: coachA.id,
    })).body;

    const assign = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/division`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ divisionId: div.id });
    expect(assign.status).toBe(200);
    expect(assign.body.divisionId).toBe(div.id);
    expect(assign.body.coachId).toBe(coachA.id);

    const refreshed = await prisma.user.findUnique({
      where: { id: learnerA.id },
      select: { divisionId: true, coachId: true },
    });
    expect(refreshed?.divisionId).toBe(div.id);
    expect(refreshed?.coachId).toBe(coachA.id);

    const learnerToken = await loginAs(learnerA.email, learnerA.password);
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${learnerToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.division?.id).toBe(div.id);
    expect(me.body.user.coach?.id).toBe(coachA.id);
  });

  it('cambiar el coach de la división re-sincroniza el coach de sus learners', async () => {
    const div = (await createDivision(adminToken, {
      sedeId: sedeA.id,
      name: 'Ventas Norte',
      coachId: coachA.id,
    })).body;
    await request(app)
      .patch(`/api/admin/users/${learnerA.id}/division`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ divisionId: div.id });

    const patch = await request(app)
      .patch(`/api/admin/divisions/${div.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachA2.id });
    expect(patch.status).toBe(200);
    expect(patch.body.coach?.id).toBe(coachA2.id);

    const refreshed = await prisma.user.findUnique({
      where: { id: learnerA.id },
      select: { coachId: true },
    });
    expect(refreshed?.coachId).toBe(coachA2.id);
  });

  it('borrar una división con estudiantes asignados → 409', async () => {
    const div = (await createDivision(adminToken, {
      sedeId: sedeA.id,
      name: 'Ventas Norte',
      coachId: coachA.id,
    })).body;
    await request(app)
      .patch(`/api/admin/users/${learnerA.id}/division`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ divisionId: div.id });

    const del = await request(app)
      .delete(`/api/admin/divisions/${div.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(409);
  });

  it('un coach normal NO puede crear divisiones (403)', async () => {
    const coachToken = await loginAs(coachA.email, coachA.password);
    const res = await createDivision(coachToken, { sedeId: sedeA.id, name: 'X' });
    expect(res.status).toBe(403);
  });

  it('un coach con canAccessAdmin SÍ puede crear divisiones (toggle = admin global)', async () => {
    const adminCoach = await seedUser({
      email: 'coach-admin@div.test',
      role: 'coach',
      sedeId: sedeA.id,
      canAccessAdmin: true,
    });
    const token = await loginAs(adminCoach.email, adminCoach.password);

    // Puede crear en su sede...
    const inOwn = await createDivision(token, { sedeId: sedeA.id, name: 'Propia' });
    expect(inOwn.status).toBe(201);

    // ...y también en OTRA sede (acceso global, atraviesa sedes).
    const inOther = await createDivision(token, { sedeId: sedeB.id, name: 'Otra' });
    expect(inOther.status).toBe(201);
  });
});
