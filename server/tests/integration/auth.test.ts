import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase, ensureTestSede } from '../helpers/db.js';

describe('Auth flow', () => {
  let sedeId: string;
  let sedeSlug: string;

  beforeEach(async () => {
    await resetDatabase();
    const sede = await ensureTestSede();
    sedeId = sede.id;
    sedeSlug = sede.slug;
  });

  it('signup crea un usuario y devuelve tokens', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'test1@example.com',
      password: 'supersecret',
      firstName: 'Ana',
      lastName: 'López',
      sede: sedeSlug,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test1@example.com');
    expect(res.body.user.id).toBeTypeOf('string');
    expect(res.body.user.sedeId).toBe(sedeId);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
  });

  it('signup falla con 400 si no se manda sede', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'nosedeyet@example.com',
      password: 'supersecret',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sede/i);
  });

  it('signup rechaza emails duplicados con 409', async () => {
    await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'supersecret',
      sede: sedeSlug,
    });

    const res = await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'anotherpass',
      sede: sedeSlug,
    });

    expect(res.status).toBe(409);
  });

  it('login con credenciales correctas devuelve tokens; inválidas devuelve 401', async () => {
    const passwordHash = await bcrypt.hash('correcthorse', 12);
    await prisma.user.create({
      data: {
        email: 'login@example.com',
        passwordHash,
        emailVerified: true,
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
    expect(Array.isArray(ok.body.user.roles)).toBe(true);

    const bad = await request(app).post('/auth/login').send({
      email: 'login@example.com',
      password: 'wrong',
    });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/me requiere token y devuelve el usuario actual con sede y roles', async () => {
    const signup = await request(app).post('/auth/signup').send({
      email: 'me@example.com',
      password: 'supersecret',
      sede: sedeSlug,
    });
    const token = signup.body.accessToken;

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
