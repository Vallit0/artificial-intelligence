// ============================================
// User Management — regression tests
// ============================================
//
// Cubre los bugs encontrados durante el stress test contra prod:
//   1. PATCH /admin/users/bulk/examen-final no debe colisionar con :id
//   2. POST /admin/users/bulk debe validar sedeId y procesar correctamente
//   3. Política de password mínima consistente (12 chars en create)
//   4. Coach NO puede crear admin ni instructor (sólo coach en su sede)
//   5. Bulk create paraleliza sin duplicar emails dentro del lote
//   6. Single create con email duplicado devuelve conflict, no crash

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
  canCreateCoaches?: boolean;
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
        canCreateCoaches: opts.canCreateCoaches ?? false,
        canEditPrompts: false,
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

describe('User management — regression suite', () => {
  let sede: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachNoPerms: { id: string; email: string; password: string };
  let coachWithCreate: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sede = await createSede('test-sede', 'Test Sede');
    admin = await seedUser({ email: 'admin@um.test', role: 'admin', sedeId: sede.id });
    coachNoPerms = await seedUser({ email: 'coach-noperms@um.test', role: 'coach', sedeId: sede.id, canCreateCoaches: false });
    coachWithCreate = await seedUser({ email: 'coach-canmake@um.test', role: 'coach', sedeId: sede.id, canCreateCoaches: true });
    adminToken = await loginAs(admin.email, admin.password);
  });

  // ============================================
  // BUG #1: orden de rutas bulk vs :id
  // ============================================

  describe('PATCH /admin/users/bulk/examen-final', () => {
    it('NO debe colisionar con /users/:id/examen-final (regression: route order)', async () => {
      const u1 = await seedUser({ email: 'l1@um.test', role: 'learner', sedeId: sede.id });
      const u2 = await seedUser({ email: 'l2@um.test', role: 'learner', sedeId: sede.id });

      const res = await request(app)
        .patch('/api/admin/users/bulk/examen-final')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [u1.id, u2.id], enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);

      // Verificación que ambos quedaron habilitados
      const refreshed = await prisma.user.findMany({
        where: { id: { in: [u1.id, u2.id] } },
        select: { examenFinalEnabled: true },
      });
      expect(refreshed.every((u) => u.examenFinalEnabled)).toBe(true);
    });

    it('valida userIds (vacío rechazado)', async () => {
      const res = await request(app)
        .patch('/api/admin/users/bulk/examen-final')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [], enabled: true });
      expect(res.status).toBe(400);
    });

    it('PATCH /users/:id/examen-final sigue funcionando con UUID válido', async () => {
      const u1 = await seedUser({ email: 'single@um.test', role: 'learner', sedeId: sede.id });
      const res = await request(app)
        .patch(`/api/admin/users/${u1.id}/examen-final`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });
      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // BUG #2: bulk create requiere sedeId
  // ============================================

  describe('POST /admin/users/bulk', () => {
    it('falla si NO se pasa sedeId ni por-user ni default', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          users: [
            { email: 'no-sede-1@um.test', password: 'Password12345!' },
            { email: 'no-sede-2@um.test', password: 'Password12345!' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.summary.created).toBe(0);
      expect(res.body.summary.failed).toBe(2);
      expect(res.body.results.every((r: any) => /sedeId/i.test(r.error))).toBe(true);
    });

    it('crea N usuarios cuando se pasa defaultSedeId', async () => {
      const users = Array.from({ length: 12 }, (_, i) => ({
        email: `bulk-${i}@um.test`,
        password: 'Password12345!',
      }));
      const res = await request(app)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ users, sedeId: sede.id });

      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBe(12);
      expect(res.body.summary.created).toBe(12);
      expect(res.body.summary.failed).toBe(0);

      const created = await prisma.user.count({ where: { email: { startsWith: 'bulk-' } } });
      expect(created).toBe(12);
    });

    it('maneja correctamente emails duplicados dentro del mismo lote', async () => {
      // Dos emails iguales dentro del lote — el primer chunk los procesa en
      // paralelo, P2002 debería detectar el duplicado de DB.
      const res = await request(app)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          users: [
            { email: 'dup@um.test', password: 'Password12345!' },
            { email: 'dup@um.test', password: 'Password12345!' },
            { email: 'unique@um.test', password: 'Password12345!' },
          ],
          sedeId: sede.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.summary.created).toBe(2); // dup (1ra ocurrencia) + unique
      expect(res.body.summary.failed).toBe(1);
      const dupCount = await prisma.user.count({ where: { email: 'dup@um.test' } });
      expect(dupCount).toBe(1);
    });

    it('rechaza passwords < 12 chars', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          users: [{ email: 'short@um.test', password: 'short' }],
          sedeId: sede.id,
        });
      expect(res.body.summary.failed).toBe(1);
      expect(res.body.results[0].error).toMatch(/12 caracteres/i);
    });

    it('coach NO puede hacer bulk create (sólo admin global)', async () => {
      const coachToken = await loginAs(coachWithCreate.email, coachWithCreate.password);
      const res = await request(app)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ users: [{ email: 'x@um.test', password: 'Password12345!' }], sedeId: sede.id });
      expect(res.status).toBe(403);
    });
  });

  // ============================================
  // BUG #4: coach con canCreateCoaches sólo crea coaches en su sede
  // ============================================

  describe('POST /admin/users (single) — autorización por rol', () => {
    it('coach con canCreateCoaches NO puede crear admin', async () => {
      const coachToken = await loginAs(coachWithCreate.email, coachWithCreate.password);
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          email: 'new-admin@um.test',
          password: 'Password12345!',
          role: 'admin',
          sedeId: sede.id,
        });
      expect(res.status).toBe(403);
    });

    it('coach con canCreateCoaches NO puede crear learner', async () => {
      const coachToken = await loginAs(coachWithCreate.email, coachWithCreate.password);
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          email: 'new-learner@um.test',
          password: 'Password12345!',
          role: 'learner',
          sedeId: sede.id,
        });
      expect(res.status).toBe(403);
    });

    it('coach con canCreateCoaches SÍ puede crear coach en su sede', async () => {
      const coachToken = await loginAs(coachWithCreate.email, coachWithCreate.password);
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          email: 'new-coach@um.test',
          password: 'Password12345!',
          role: 'coach',
          sedeId: sede.id,
        });
      expect(res.status).toBe(201);
    });

    it('coach SIN canCreateCoaches NO puede crear coach', async () => {
      const coachToken = await loginAs(coachNoPerms.email, coachNoPerms.password);
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          email: 'denied-coach@um.test',
          password: 'Password12345!',
          role: 'coach',
          sedeId: sede.id,
        });
      expect(res.status).toBe(403);
    });

    it('admin crea coach con coachPermissions inicializadas en false', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin-created-coach@um.test',
          password: 'Password12345!',
          role: 'coach',
          sedeId: sede.id,
        });
      expect(res.status).toBe(201);
      const created = await prisma.user.findUnique({
        where: { email: 'admin-created-coach@um.test' },
        include: { coachPermissions: true },
      });
      expect(created?.coachPermissions?.canCreateCoaches).toBe(false);
      expect(created?.coachPermissions?.canEditPrompts).toBe(false);
    });

    it('rechaza password < 12 chars', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'short@um.test',
          password: 'tiny',
          role: 'learner',
          sedeId: sede.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/12 caracteres/i);
    });

    it('rechaza email duplicado con 409', async () => {
      const r1 = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dupe@um.test',
          password: 'Password12345!',
          role: 'learner',
          sedeId: sede.id,
        });
      expect(r1.status).toBe(201);

      const r2 = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dupe@um.test',
          password: 'Password12345!',
          role: 'learner',
          sedeId: sede.id,
        });
      expect(r2.status).toBe(409);
    });
  });

  // ============================================
  // DELETE — admin global sólo, no self-delete
  // ============================================

  describe('DELETE /admin/users/:id', () => {
    it('admin no puede borrarse a sí mismo', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('admin borra learner — cascade de roles/sessions', async () => {
      const l = await seedUser({ email: 'tobedeleted@um.test', role: 'learner', sedeId: sede.id });
      // Crear una practice_session para verificar cascade
      await prisma.practiceSession.create({
        data: { userId: l.id, durationSeconds: 30 },
      });

      const res = await request(app)
        .delete(`/api/admin/users/${l.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const userExists = await prisma.user.findUnique({ where: { id: l.id } });
      expect(userExists).toBeNull();

      const orphanSessions = await prisma.practiceSession.count({ where: { userId: l.id } });
      expect(orphanSessions).toBe(0);
    });

    it('coach NO puede borrar usuarios (admin global only)', async () => {
      const l = await seedUser({ email: 'untouchable@um.test', role: 'learner', sedeId: sede.id });
      const coachToken = await loginAs(coachWithCreate.email, coachWithCreate.password);
      const res = await request(app)
        .delete(`/api/admin/users/${l.id}`)
        .set('Authorization', `Bearer ${coachToken}`);
      expect(res.status).toBe(403);
    });
  });
});
