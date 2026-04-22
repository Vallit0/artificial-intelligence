import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';

describe('Auth flow', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('signup crea un usuario y devuelve tokens', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'test1@example.com',
      password: 'supersecret',
      firstName: 'Ana',
      lastName: 'López',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test1@example.com');
    expect(res.body.user.id).toBeTypeOf('string');
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
  });

  it('signup rechaza emails duplicados con 409', async () => {
    await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'supersecret',
    });

    const res = await request(app).post('/auth/signup').send({
      email: 'dup@example.com',
      password: 'anotherpass',
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
        roles: { create: { role: 'learner' } },
      },
    });

    const ok = await request(app).post('/auth/login').send({
      email: 'login@example.com',
      password: 'correcthorse',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTypeOf('string');

    const bad = await request(app).post('/auth/login').send({
      email: 'login@example.com',
      password: 'wrong',
    });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/me requiere token y devuelve el usuario actual', async () => {
    const signup = await request(app).post('/auth/signup').send({
      email: 'me@example.com',
      password: 'supersecret',
    });
    const token = signup.body.accessToken;

    const noAuth = await request(app).get('/auth/me');
    expect(noAuth.status).toBe(401);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.roles).toContain('learner');
  });
});
