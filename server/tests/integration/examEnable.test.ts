// ============================================
// Habilitar exámenes — PATCH /api/admin/users/:id/examen-final (+ bulk)
// ============================================
//
// Cubre la feature de habilitar los DOS exámenes finales:
//   1. Admin habilita Prospección y/u Objeciones (single + bulk), columnas
//      independientes (examenFinalEnabled / examenObjecionesEnabled).
//   2. Coach habilita exámenes SÓLO a sus estudiantes asignados (coachId ===
//      coach.id): a un sede-mate NO asignado → 404 (single) / no contado (bulk).

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

const flagsOf = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: { examenFinalEnabled: true, examenObjecionesEnabled: true },
  });

describe('Habilitar exámenes', () => {
  let sedeA: { id: string };
  let admin: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let asignado: { id: string; email: string; password: string };
  let noAsignado: { id: string; email: string; password: string };
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    admin = await seedUser({ email: 'admin@ex.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach@ex.test', role: 'coach', sedeId: sedeA.id });
    asignado = await seedUser({ email: 'asig@ex.test', role: 'learner', sedeId: sedeA.id, coachId: coachA.id });
    // Mismo sede que coachA pero NO asignado a él.
    noAsignado = await seedUser({ email: 'noasig@ex.test', role: 'learner', sedeId: sedeA.id });
    adminToken = await loginAs(admin.email, admin.password);
  });

  it('default: ambos exámenes nacen bloqueados', async () => {
    expect(await flagsOf(asignado.id)).toMatchObject({
      examenFinalEnabled: false,
      examenObjecionesEnabled: false,
    });
  });

  it('admin habilita Objeciones sin tocar Prospección (single)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${asignado.id}/examen-final`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, exam: 'objeciones' });

    expect(res.status).toBe(200);
    expect(await flagsOf(asignado.id)).toMatchObject({
      examenFinalEnabled: false,
      examenObjecionesEnabled: true,
    });
  });

  it('admin habilita Prospección por default cuando no manda exam', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${asignado.id}/examen-final`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(await flagsOf(asignado.id)).toMatchObject({
      examenFinalEnabled: true,
      examenObjecionesEnabled: false,
    });
  });

  it('admin bulk habilita Objeciones para varios', async () => {
    const res = await request(app)
      .patch('/api/admin/users/bulk/examen-final')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userIds: [asignado.id, noAsignado.id], enabled: true, exam: 'objeciones' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.exam).toBe('objeciones');
    expect((await flagsOf(noAsignado.id))?.examenObjecionesEnabled).toBe(true);
  });

  it('coach habilita examen SÓLO a su estudiante asignado (single)', async () => {
    const coachToken = await loginAs(coachA.email, coachA.password);

    const ok = await request(app)
      .patch(`/api/admin/users/${asignado.id}/examen-final`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ enabled: true, exam: 'prospeccion' });
    expect(ok.status).toBe(200);
    expect((await flagsOf(asignado.id))?.examenFinalEnabled).toBe(true);

    // Sede-mate NO asignado → 404 (no filtra existencia) y sin cambios.
    const denied = await request(app)
      .patch(`/api/admin/users/${noAsignado.id}/examen-final`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ enabled: true, exam: 'prospeccion' });
    expect(denied.status).toBe(404);
    expect((await flagsOf(noAsignado.id))?.examenFinalEnabled).toBe(false);
  });

  it('coach bulk afecta SÓLO a sus asignados (count refleja el filtro)', async () => {
    const coachToken = await loginAs(coachA.email, coachA.password);

    const res = await request(app)
      .patch('/api/admin/users/bulk/examen-final')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ userIds: [asignado.id, noAsignado.id], enabled: true, exam: 'objeciones' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1); // sólo el asignado
    expect((await flagsOf(asignado.id))?.examenObjecionesEnabled).toBe(true);
    expect((await flagsOf(noAsignado.id))?.examenObjecionesEnabled).toBe(false);
  });
});
