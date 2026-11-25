// ============================================
// PATCH /auth/me — editar mi propio nombre
// ============================================
//
// El nombre (firstName) se envía al agente de ElevenLabs como `advisor_name`.
// Las cuentas admin nacen sin nombre → el agente saludaba "Visitante". Este
// endpoint deja que admin/coach se pongan nombre; learners siguen bloqueados.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase, ensureTestSede } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

const PASSWORD = 'supersecret-abc';

async function seedUser(email: string, role: 'admin' | 'coach' | 'learner', sedeId: string) {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      emailVerified: true,
      status: 'approved',
      sedeId,
      roles: { create: { role } },
    },
  });
  if (role === 'coach') {
    await prisma.coachPermission.create({
      data: { userId: user.id, canCreateCoaches: false, canEditPrompts: false },
    });
  }
  return user;
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

describe('PATCH /auth/me — nombre propio', () => {
  let sedeId: string;

  beforeEach(async () => {
    await resetDatabase();
    sedeId = (await ensureTestSede()).id;
  });

  it('admin sin nombre se pone nombre y /auth/me lo refleja', async () => {
    await seedUser('admin@pn.test', 'admin', sedeId);
    const token = await loginAs('admin@pn.test');

    const before = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.user.firstName).toBeUndefined();

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '  Carlos ', lastName: ' Pérez ' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: 'Carlos', lastName: 'Pérez' });

    const after = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(after.body.user.firstName).toBe('Carlos');
    expect(after.body.user.lastName).toBe('Pérez');
  });

  it('coach también puede editar su nombre; apellido vacío queda null', async () => {
    await seedUser('coach@pn.test', 'coach', sedeId);
    const token = await loginAs('coach@pn.test');

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ana', lastName: '' });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Ana');
    expect(res.body.user.lastName).toBeNull();
  });

  it('learner recibe 403 (su nombre lo administra el admin)', async () => {
    const learner = await seedUser('learner@pn.test', 'learner', sedeId);
    const token = await loginAs('learner@pn.test');

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Hacker' });
    expect(res.status).toBe(403);

    const row = await prisma.user.findUnique({ where: { id: learner.id } });
    expect(row?.firstName).toBeNull();
  });

  it('rechaza nombre vacío o demasiado largo', async () => {
    await seedUser('admin2@pn.test', 'admin', sedeId);
    const token = await loginAs('admin2@pn.test');

    const empty = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '   ' });
    expect(empty.status).toBe(400);

    const long = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'x'.repeat(51) });
    expect(long.status).toBe(400);
  });

  it('sin token → 401', async () => {
    const res = await request(app).patch('/auth/me').send({ firstName: 'Nadie' });
    expect(res.status).toBe(401);
  });
});
