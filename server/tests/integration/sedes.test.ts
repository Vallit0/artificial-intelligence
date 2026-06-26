import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';

// ============================================
// Helpers para crear users de cada rol/sede
// ============================================

async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

interface SeedUserOpts {
  email: string;
  password?: string;
  role?: 'admin' | 'learner' | 'coach' | 'instructor';
  sedeId: string;
  canCreateCoaches?: boolean;
  canEditPrompts?: boolean;
}

async function seedUser(opts: SeedUserOpts) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await bcrypt.hash(password, 12);
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
        canEditPrompts: opts.canEditPrompts ?? false,
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

// ============================================
// Tests
// ============================================

describe('Multi-sede: aislamiento duro entre sedes', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let adminGlobal: { id: string; email: string; password: string };
  let coachA: { id: string; email: string; password: string };
  let coachB: { id: string; email: string; password: string };
  let learnerA: { id: string; email: string; password: string };
  let learnerB: { id: string; email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    sedeB = await createSede('sede-b', 'Sede B');
    adminGlobal = await seedUser({ email: 'admin@global.test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach-a@test', role: 'coach', sedeId: sedeA.id, canCreateCoaches: false });
    coachB = await seedUser({ email: 'coach-b@test', role: 'coach', sedeId: sedeB.id, canCreateCoaches: false });
    learnerA = await seedUser({ email: 'learner-a@test', role: 'learner', sedeId: sedeA.id });
    learnerB = await seedUser({ email: 'learner-b@test', role: 'learner', sedeId: sedeB.id });
  });

  it('GET /api/admin/students: coach de sede A ve sólo learners de sede A', async () => {
    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .get('/api/admin/students')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const emails = res.body.map((s: any) => s.email);
    expect(emails).toContain('learner-a@test');
    expect(emails).not.toContain('learner-b@test');
  });

  it('GET /api/admin/students: admin global ve learners de todas las sedes', async () => {
    const token = await loginAs(adminGlobal.email, adminGlobal.password);
    const res = await request(app)
      .get('/api/admin/students')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const emails = res.body.map((s: any) => s.email);
    expect(emails).toContain('learner-a@test');
    expect(emails).toContain('learner-b@test');
  });

  it('PATCH /api/admin/users/:id: coach de sede A no puede modificar learner de sede B (404)', async () => {
    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .patch(`/api/admin/users/${learnerB.id}/name`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Hacked' });
    // 404 en vez de 403 para no filtrar existencia entre sedes.
    expect(res.status).toBe(404);

    // Confirmamos que no se aplicó el cambio.
    const fresh = await prisma.user.findUnique({ where: { id: learnerB.id } });
    expect(fresh?.firstName).not.toBe('Hacked');
  });

  it('PATCH /api/admin/users/:id: coach de sede A puede modificar learner de su misma sede', async () => {
    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .patch(`/api/admin/users/${learnerA.id}/name`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Renombrado' });
    expect(res.status).toBe(200);
    const fresh = await prisma.user.findUnique({ where: { id: learnerA.id } });
    expect(fresh?.firstName).toBe('Renombrado');
  });

  it('DELETE /api/admin/users/:id: coach NO puede borrar usuarios (admin global only)', async () => {
    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .delete(`/api/admin/users/${learnerA.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Multi-sede: creación de coaches', () => {
  let sedeA: { id: string };
  let sedeB: { id: string };
  let adminGlobal: { email: string; password: string };
  let coachWithCreate: { email: string; password: string };
  let coachWithoutCreate: { email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    sedeB = await createSede('sede-b', 'Sede B');
    adminGlobal = await seedUser({ email: 'admin@test', role: 'admin', sedeId: sedeA.id });
    coachWithCreate = await seedUser({
      email: 'coach-create@test',
      role: 'coach',
      sedeId: sedeA.id,
      canCreateCoaches: true,
    });
    coachWithoutCreate = await seedUser({
      email: 'coach-nocreate@test',
      role: 'coach',
      sedeId: sedeA.id,
      canCreateCoaches: false,
    });
  });

  it('signup público NUNCA crea rol coach (siempre learner)', async () => {
    // El signup ahora exige sede + división de esa sede; creamos una división
    // de sede-a con un coach de esa sede.
    const coach = await prisma.user.findFirst({
      where: { sedeId: sedeA.id, roles: { some: { role: 'coach' } } },
      select: { id: true },
    });
    const division = await prisma.division.create({
      data: { name: 'División sede-a', sedeId: sedeA.id, coachId: coach!.id },
    });
    const res = await request(app).post('/auth/signup').send({
      email: 'public-signup@test.com',
      password: 'supersecret-abc',
      role: 'coach',         // intento de injection — debe ignorarse
      sede: 'sede-a',
      divisionId: division.id,
    });
    expect(res.status).toBe(201);
    const userRoles = await prisma.userRole.findMany({
      where: { user: { email: 'public-signup@test.com' } },
      select: { role: true },
    });
    expect(userRoles.map((r) => r.role)).toEqual(['learner']);
    expect(userRoles.map((r) => r.role)).not.toContain('coach');
  });

  it('coach SIN canCreateCoaches no puede crear coaches (403)', async () => {
    const token = await loginAs(coachWithoutCreate.email, coachWithoutCreate.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nuevo-coach@test.com',
        password: 'supersecret-abc',
        role: 'coach',
        sedeId: sedeA.id,
      });
    expect(res.status).toBe(403);
  });

  it('coach CON canCreateCoaches puede crear coach en SU sede', async () => {
    const token = await loginAs(coachWithCreate.email, coachWithCreate.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nuevo-coach@test.com',
        password: 'supersecret-abc',
        role: 'coach',
        sedeId: sedeA.id,
      });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('coach');
    // El nuevo coach tiene CoachPermission con flags en false.
    const perm = await prisma.coachPermission.findUnique({
      where: { userId: res.body.user.id },
    });
    expect(perm?.canCreateCoaches).toBe(false);
    expect(perm?.canEditPrompts).toBe(false);
  });

  it('coach CON canCreateCoaches NO puede crear coach en OTRA sede', async () => {
    const token = await loginAs(coachWithCreate.email, coachWithCreate.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nuevo-coach@test.com',
        password: 'supersecret-abc',
        role: 'coach',
        sedeId: sedeB.id, // sede distinta
      });
    expect(res.status).toBe(403);
  });

  it('coach NO puede crear learners (sólo coaches dentro de su sede)', async () => {
    const token = await loginAs(coachWithCreate.email, coachWithCreate.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nuevo-learner@test.com',
        password: 'supersecret-abc',
        role: 'learner',
        sedeId: sedeA.id,
      });
    expect(res.status).toBe(403);
  });

  it('admin global puede crear coaches en cualquier sede', async () => {
    const token = await loginAs(adminGlobal.email, adminGlobal.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'coach-en-b@test.com',
        password: 'supersecret-abc',
        role: 'coach',
        sedeId: sedeB.id,
      });
    expect(res.status).toBe(201);
    expect(res.body.user.sedeId).toBe(sedeB.id);
  });

  it('PATCH /api/admin/coaches/:id/permissions: coach NO puede cambiar permisos (403)', async () => {
    const token = await loginAs(coachWithCreate.email, coachWithCreate.password);
    const res = await request(app)
      .patch(`/api/admin/coaches/${coachWithoutCreate.email}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ canCreateCoaches: true });
    // Aunque el path no resuelva a ID real (usamos email por simplicidad
    // del test) lo que importa es el 403 del middleware antes del lookup.
    expect(res.status).toBe(403);
  });

  it('PATCH /api/admin/coaches/:id/permissions: admin global puede cambiar permisos', async () => {
    const adminToken = await loginAs(adminGlobal.email, adminGlobal.password);
    // Necesitamos el ID del coach
    const coach = await prisma.user.findUnique({ where: { email: coachWithoutCreate.email } });
    const res = await request(app)
      .patch(`/api/admin/coaches/${coach!.id}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ canCreateCoaches: true, canEditPrompts: true });
    expect(res.status).toBe(200);
    expect(res.body.canCreateCoaches).toBe(true);
    expect(res.body.canEditPrompts).toBe(true);
  });
});

describe('Multi-sede: edit de prompts requiere canEditPrompts o admin', () => {
  let sedeA: { id: string };
  let adminGlobal: { email: string; password: string };
  let coachWithEdit: { email: string; password: string };
  let coachWithoutEdit: { email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    adminGlobal = await seedUser({ email: 'admin@test', role: 'admin', sedeId: sedeA.id });
    coachWithEdit = await seedUser({
      email: 'coach-edit@test',
      role: 'coach',
      sedeId: sedeA.id,
      canEditPrompts: true,
    });
    coachWithoutEdit = await seedUser({
      email: 'coach-noedit@test',
      role: 'coach',
      sedeId: sedeA.id,
      canEditPrompts: false,
    });
  });

  it('coach SIN canEditPrompts no puede editar prompts (403)', async () => {
    const token = await loginAs(coachWithoutEdit.email, coachWithoutEdit.password);
    const res = await request(app)
      .put('/api/admin/prospecting-scenarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        secretName: 'test_secret',
        systemPrompt: 'malicious prompt',
      });
    expect(res.status).toBe(403);
  });

  it('coach CON canEditPrompts puede editar prompts', async () => {
    const token = await loginAs(coachWithEdit.email, coachWithEdit.password);
    const res = await request(app)
      .put('/api/admin/prospecting-scenarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        secretName: 'test_secret',
        systemPrompt: 'new prompt',
        label: 'Test',
      });
    expect(res.status).toBe(200);
  });
});

describe('Multi-sede: CRUD de sedes (admin global only)', () => {
  let sedeA: { id: string };
  let adminGlobal: { email: string; password: string };
  let coachA: { email: string; password: string };

  beforeEach(async () => {
    await resetDatabase();
    sedeA = await createSede('sede-a', 'Sede A');
    adminGlobal = await seedUser({ email: 'admin@test', role: 'admin', sedeId: sedeA.id });
    coachA = await seedUser({ email: 'coach@test', role: 'coach', sedeId: sedeA.id });
  });

  it('GET /api/sedes (público): devuelve sedes activas con campos mínimos', async () => {
    const res = await request(app).get('/api/sedes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('slug');
    expect(res.body[0]).toHaveProperty('name');
    // No incluir campos sensibles como address en la versión pública.
    expect(res.body[0]).not.toHaveProperty('address');
  });

  it('POST /api/admin/sedes: coach NO puede crear sedes (403)', async () => {
    const token = await loginAs(coachA.email, coachA.password);
    const res = await request(app)
      .post('/api/admin/sedes')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'nueva', name: 'Nueva Sede' });
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/sedes: admin global puede crear sedes', async () => {
    const token = await loginAs(adminGlobal.email, adminGlobal.password);
    const res = await request(app)
      .post('/api/admin/sedes')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'nueva', name: 'Nueva Sede', country: 'MX' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('nueva');
  });

  it('DELETE /api/admin/sedes/:id: rechaza si hay users asignados (409)', async () => {
    const token = await loginAs(adminGlobal.email, adminGlobal.password);
    // sedeA tiene al menos admin y coach asignados.
    const res = await request(app)
      .delete(`/api/admin/sedes/${sedeA.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
