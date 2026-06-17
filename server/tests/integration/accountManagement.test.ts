// ============================================
// Account approval + unified user editing
// ============================================
//
// Cubre el flujo de auto-registro con aprobación (Fase 1) y la edición
// unificada de usuario por admin global (Fase 2).

import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';

async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

interface SeedOpts {
  email: string;
  password?: string;
  role?: 'admin' | 'learner' | 'coach' | 'instructor';
  sedeId: string;
  status?: 'pending' | 'approved' | 'rejected';
  coachId?: string;
}

async function seedUser(opts: SeedOpts) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      status: opts.status ?? 'approved',
      sedeId: opts.sedeId,
      coachId: opts.coachId,
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

describe('Account approval flow', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a');
    sedeB = await createSede('sede-b');
    admin = await seedUser({ email: 'admin@am.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@am.test', role: 'coach', sedeId: sedeA.id });
    adminToken = await loginAs(admin.email, admin.password);
  });

  it('GET /users/pending: admin ve todas las sedes, coach sólo la suya', async () => {
    await seedUser({ email: 'p-a@am.test', role: 'learner', sedeId: sedeA.id, status: 'pending', coachId: coachA.id });
    await seedUser({ email: 'p-b@am.test', role: 'learner', sedeId: sedeB.id, status: 'pending' });

    const adminRes = await request(app)
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.map((u: any) => u.email).sort()).toEqual(['p-a@am.test', 'p-b@am.test']);

    const coachToken = await loginAs(coachA.email, coachA.password);
    const coachRes = await request(app)
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(coachRes.status).toBe(200);
    expect(coachRes.body.map((u: any) => u.email)).toEqual(['p-a@am.test']);
  });

  it('PATCH approval: aprobar habilita el login', async () => {
    const pending = await seedUser({
      email: 'approveme@am.test',
      role: 'learner',
      sedeId: sedeA.id,
      status: 'pending',
      coachId: coachA.id,
    });

    const res = await request(app)
      .patch(`/api/admin/users/${pending.id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const updated = await prisma.user.findUnique({ where: { id: pending.id } });
    expect(updated?.status).toBe('approved');
    expect(updated?.approvedBy).toBe(admin.id);

    const ok = await request(app).post('/auth/login').send({
      email: pending.email,
      password: pending.password,
    });
    expect(ok.status).toBe(200);
  });

  it('PATCH approval: rechazar setea rejected + motivo', async () => {
    const pending = await seedUser({
      email: 'rejectme@am.test',
      role: 'learner',
      sedeId: sedeA.id,
      status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/admin/users/${pending.id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'reject', reason: 'Datos incompletos' });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: pending.id } });
    expect(updated?.status).toBe('rejected');
    expect(updated?.rejectedReason).toBe('Datos incompletos');
  });

  it('coach NO puede aprobar usuarios de otra sede (404)', async () => {
    const pendingB = await seedUser({
      email: 'p-otra@am.test',
      role: 'learner',
      sedeId: sedeB.id,
      status: 'pending',
    });
    const coachToken = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .patch(`/api/admin/users/${pendingB.id}/approval`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(404);
  });

  it('re-aprobar un usuario ya procesado devuelve 400', async () => {
    const approved = await seedUser({ email: 'already@am.test', role: 'learner', sedeId: sedeA.id, status: 'approved' });
    const res = await request(app)
      .patch(`/api/admin/users/${approved.id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(400);
  });
});

describe('Unified user editing (PATCH /admin/users/:id)', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let coachB: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a');
    sedeB = await createSede('sede-b');
    admin = await seedUser({ email: 'admin@edit.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@edit.test', role: 'coach', sedeId: sedeA.id });
    coachB = await seedUser({ email: 'coach-b@edit.test', role: 'coach', sedeId: sedeB.id });
    adminToken = await loginAs(admin.email, admin.password);
  });

  it('actualiza nombre y teléfono', async () => {
    const u = await seedUser({ email: 'edit1@edit.test', role: 'learner', sedeId: sedeA.id });
    const res = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Nuevo', phoneNumber: '502 1111 2222' });
    expect(res.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.firstName).toBe('Nuevo');
    expect(updated?.phoneNumber).toBe('502 1111 2222');
  });

  it('mover de sede exige coachId y valida que el coach sea de la sede destino', async () => {
    const u = await seedUser({ email: 'move@edit.test', role: 'learner', sedeId: sedeA.id, coachId: coachA.id });

    // Sin coachId al mover de sede → 400.
    const noCoach = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sedeId: sedeB.id });
    expect(noCoach.status).toBe(400);

    // Con coach de la sede equivocada (coachA es de sedeA) → 400.
    const wrongCoach = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sedeId: sedeB.id, coachId: coachA.id });
    expect(wrongCoach.status).toBe(400);

    // Con coach correcto de la sede destino → 200.
    const ok = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sedeId: sedeB.id, coachId: coachB.id });
    expect(ok.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.sedeId).toBe(sedeB.id);
    expect(updated?.coachId).toBe(coachB.id);
  });

  it('reescribe roles y crea CoachPermission al volverse coach', async () => {
    const u = await seedUser({ email: 'role@edit.test', role: 'learner', sedeId: sedeA.id });
    const res = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roles: ['learner', 'coach'] });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({
      where: { id: u.id },
      include: { roles: true, coachPermissions: true },
    });
    expect(updated?.roles.map((r) => r.role).sort()).toEqual(['coach', 'learner']);
    expect(updated?.coachPermissions).not.toBeNull();
  });

  it('admin no puede quitarse a sí mismo su propio rol admin', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roles: ['learner'] });
    expect(res.status).toBe(400);
  });

  it('cambiar email a uno existente devuelve 409; cambio válido revoca refresh tokens', async () => {
    const taken = await seedUser({ email: 'taken@edit.test', role: 'learner', sedeId: sedeA.id });
    const u = await seedUser({ email: 'changer@edit.test', role: 'learner', sedeId: sedeA.id });
    // Genera un refresh token logueándose.
    await loginAs(u.email, u.password);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBeGreaterThan(0);

    const conflict = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: taken.email });
    expect(conflict.status).toBe(409);

    const ok = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newemail@edit.test' });
    expect(ok.status).toBe(200);
    expect(await prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
  });

  it('un coach NO puede usar el editor unificado (403)', async () => {
    const u = await seedUser({ email: 'victim@edit.test', role: 'learner', sedeId: sedeA.id });
    const coachToken = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ firstName: 'Hack' });
    expect(res.status).toBe(403);
  });
});
