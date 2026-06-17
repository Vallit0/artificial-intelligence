import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase, ensureTestSede } from '../helpers/db.js';

// Crea un coach aprobado en una sede (para el selector de coach del signup).
async function seedCoach(email: string, sedeId: string) {
  const passwordHash = await bcrypt.hash('coachpassword12', 12);
  const coach = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId,
      roles: { create: { role: 'coach' } },
    },
  });
  await prisma.coachPermission.create({
    data: { userId: coach.id, canCreateCoaches: false, canEditPrompts: false },
  });
  return coach;
}

describe('Auth flow', () => {
  let sedeId: string;
  let sedeSlug: string;
  let coachId: string;

  beforeEach(async () => {
    await resetDatabase();
    const sede = await ensureTestSede();
    sedeId = sede.id;
    sedeSlug = sede.slug;
    const coach = await seedCoach('coach@example.com', sedeId);
    coachId = coach.id;
  });

  it('signup crea un usuario PENDING sin emitir tokens', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'test1@example.com',
      password: 'supersecret',
      firstName: 'Ana',
      lastName: 'López',
      sede: sedeSlug,
      coachId,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    const created = await prisma.user.findUnique({ where: { email: 'test1@example.com' } });
    expect(created?.status).toBe('pending');
    expect(created?.sedeId).toBe(sedeId);
    expect(created?.coachId).toBe(coachId);
  });

  it('signup falla con 400 si no se manda sede', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'nosedeyet@example.com',
      password: 'supersecret',
      coachId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sede/i);
  });

  it('signup falla con 400 si no se manda coach', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'nocoach@example.com',
      password: 'supersecret',
      sede: sedeSlug,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coach/i);
  });

  it('signup falla con 400 si el coach es de otra sede', async () => {
    const otherSede = await ensureTestSede('otra-sede', 'Otra Sede');
    const otherCoach = await seedCoach('coach-otra@example.com', otherSede.id);

    const res = await request(app).post('/auth/signup').send({
      email: 'crosscoach@example.com',
      password: 'supersecret',
      sede: sedeSlug,
      coachId: otherCoach.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coach/i);
  });

  it('signup rechaza emails duplicados con 409', async () => {
    await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'supersecret',
      sede: sedeSlug,
      coachId,
    });

    const res = await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'anotherpass',
      sede: sedeSlug,
      coachId,
    });

    expect(res.status).toBe(409);
  });

  it('login bloquea un usuario pending y permite uno approved', async () => {
    // Usuario auto-registrado → pending → login bloqueado.
    await request(app).post('/auth/signup').send({
      email: 'pending@example.com',
      password: 'supersecret',
      sede: sedeSlug,
      coachId,
    });
    const blocked = await request(app).post('/auth/login').send({
      email: 'pending@example.com',
      password: 'supersecret',
    });
    expect(blocked.status).toBe(401);
    expect(blocked.body.error).toMatch(/pendiente/i);

    // Usuario approved → login OK.
    const passwordHash = await bcrypt.hash('correcthorse', 12);
    await prisma.user.create({
      data: {
        email: 'login@example.com',
        passwordHash,
        emailVerified: true,
        status: 'approved',
        sedeId,
        roles: { create: { role: 'learner' } },
      },
    });
    const ok = await request(app).post('/auth/login').send({
      email: 'login@example.com',
      password: 'correcthorse',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTypeOf('string');
    expect(ok.body.user.sedeId).toBe(sedeId);
  });

  it('login rechaza un usuario rejected con mensaje claro', async () => {
    const passwordHash = await bcrypt.hash('correcthorse', 12);
    await prisma.user.create({
      data: {
        email: 'rejected@example.com',
        passwordHash,
        emailVerified: true,
        status: 'rejected',
        rejectedReason: 'No cumple requisitos',
        sedeId,
        roles: { create: { role: 'learner' } },
      },
    });
    const res = await request(app).post('/auth/login').send({
      email: 'rejected@example.com',
      password: 'correcthorse',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no fue aprobado/i);
  });

  it('login con credenciales inválidas devuelve 401', async () => {
    const passwordHash = await bcrypt.hash('correcthorse', 12);
    await prisma.user.create({
      data: {
        email: 'creds@example.com',
        passwordHash,
        emailVerified: true,
        status: 'approved',
        sedeId,
        roles: { create: { role: 'learner' } },
      },
    });
    const bad = await request(app).post('/auth/login').send({
      email: 'creds@example.com',
      password: 'wrong',
    });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/me requiere token y devuelve el usuario actual con sede y roles', async () => {
    const passwordHash = await bcrypt.hash('correcthorse', 12);
    await prisma.user.create({
      data: {
        email: 'me@example.com',
        passwordHash,
        emailVerified: true,
        status: 'approved',
        sedeId,
        roles: { create: { role: 'learner' } },
      },
    });
    const login = await request(app).post('/auth/login').send({
      email: 'me@example.com',
      password: 'correcthorse',
    });
    const token = login.body.accessToken;

    const noAuth = await request(app).get('/auth/me');
    expect(noAuth.status).toBe(401);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.user.sedeId).toBe(sedeId);
    expect(res.body.roles).toContain('learner');
  });
});
