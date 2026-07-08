// ============================================
// Control de acceso por rol (authz) — auditoría
// ============================================
//
// Suite de pruebas de AUTORIZACIÓN que ejercita cada capa del modelo de acceso:
//
//   1. Gate de rol del router /api/admin  (requireRole('admin','coach'))
//   2. Endpoints global-admin-only         (requireGlobalAdmin) → coach 403
//   3. Aislamiento duro entre sedes        (coach no toca datos de otra sede)
//   4. Restricciones de creación por coach (createUser)
//   5. IDOR entre learners en /api/sessions
//   6. 🔴 VULNERABILIDADES CONFIRMADAS      (bloque que DEBE fallar hasta corregir)
//
// El bloque (6) codifica el comportamiento SEGURO deseado y por lo tanto está
// ROJO contra el backend actual: cada test rojo es un bug real a corregir.
// Cuando el backend se arregle, esos tests pasan a verde. El resto es verde y
// sirve de regresión.
//
// Correr:  npm run test:db:up && npm run test:db:push && npm test -- accessControl

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

// ---------- helpers ----------
async function createSede(slug: string, name = slug.toUpperCase()) {
  return prisma.sede.create({ data: { slug, name } });
}

interface SeedUserOpts {
  email: string;
  password?: string;
  role?: 'admin' | 'learner' | 'coach' | 'instructor';
  sedeId?: string | null;
  coachId?: string | null;
  status?: string;
  canCreateCoaches?: boolean;
  canEditPrompts?: boolean;
  canAccessAdmin?: boolean;
  level2Unlocked?: boolean;
  courseCompleted?: boolean;
}

async function seedUser(opts: SeedUserOpts) {
  const password = opts.password ?? 'supersecret-abc';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      emailVerified: true,
      status: opts.status ?? 'approved',
      sedeId: opts.sedeId ?? null,
      coachId: opts.coachId ?? null,
      level2Unlocked: opts.level2Unlocked ?? false,
      courseCompleted: opts.courseCompleted ?? false,
      roles: { create: { role: opts.role ?? 'learner' } },
    },
  });
  if (opts.role === 'coach') {
    await prisma.coachPermission.create({
      data: {
        userId: user.id,
        canCreateCoaches: opts.canCreateCoaches ?? false,
        canEditPrompts: opts.canEditPrompts ?? false,
        canAccessAdmin: opts.canAccessAdmin ?? false,
      },
    });
  }
  return { id: user.id, email: user.email, password };
}

async function seedSession(userId: string, extra: Record<string, unknown> = {}) {
  return prisma.practiceSession.create({
    data: { userId, durationSeconds: 120, passed: false, ...extra },
  });
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login ${email} falló: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// ---------- fixtures compartidas ----------
let sedeA: { id: string };
let sedeB: { id: string };
let adminGlobal: { id: string; email: string; password: string };
let adminInSedeA: { id: string; email: string; password: string };
let coachA: { id: string; email: string; password: string };
let coachACreator: { id: string; email: string; password: string };
let coachB: { id: string; email: string; password: string };
let instructorA: { id: string; email: string; password: string };
let learnerA1: { id: string; email: string; password: string };
let learnerA2: { id: string; email: string; password: string };
let learnerB: { id: string; email: string; password: string };

let tAdmin: string, tCoachA: string, tCoachB: string, tInstructor: string, tLearnerA1: string, tLearnerB: string;

beforeEach(async () => {
  await resetDatabase();
  sedeA = await createSede('sede-a', 'Sede A');
  sedeB = await createSede('sede-b', 'Sede B');

  adminGlobal = await seedUser({ email: 'admin@ac.test', role: 'admin', sedeId: sedeA.id });
  adminInSedeA = await seedUser({ email: 'admin2@ac.test', role: 'admin', sedeId: sedeA.id });
  coachA = await seedUser({ email: 'coach-a@ac.test', role: 'coach', sedeId: sedeA.id });
  coachACreator = await seedUser({ email: 'coach-a-creator@ac.test', role: 'coach', sedeId: sedeA.id, canCreateCoaches: true });
  coachB = await seedUser({ email: 'coach-b@ac.test', role: 'coach', sedeId: sedeB.id });
  instructorA = await seedUser({ email: 'instructor-a@ac.test', role: 'instructor', sedeId: sedeA.id });
  learnerA1 = await seedUser({ email: 'learner-a1@ac.test', role: 'learner', sedeId: sedeA.id, coachId: coachA.id });
  learnerA2 = await seedUser({ email: 'learner-a2@ac.test', role: 'learner', sedeId: sedeA.id });
  learnerB = await seedUser({ email: 'learner-b@ac.test', role: 'learner', sedeId: sedeB.id, coachId: coachB.id });

  [tAdmin, tCoachA, tCoachB, tInstructor, tLearnerA1, tLearnerB] = await Promise.all([
    loginAs(adminGlobal.email, adminGlobal.password),
    loginAs(coachA.email, coachA.password),
    loginAs(coachB.email, coachB.password),
    loginAs(instructorA.email, instructorA.password),
    loginAs(learnerA1.email, learnerA1.password),
    loginAs(learnerB.email, learnerB.password),
  ]);
});

// ============================================
// 1. Gate de rol del router /api/admin
// ============================================
describe('1. Gate de rol en /api/admin (requireRole admin|coach)', () => {
  it('sin token → 401', async () => {
    expect((await request(app).get('/api/admin/students')).status).toBe(401);
  });
  it('learner → 403', async () => {
    expect((await request(app).get('/api/admin/students').set(auth(tLearnerA1))).status).toBe(403);
  });
  it('instructor → 403 (no está en el gate del router)', async () => {
    expect((await request(app).get('/api/admin/students').set(auth(tInstructor))).status).toBe(403);
  });
  it('coach → 200', async () => {
    expect((await request(app).get('/api/admin/students').set(auth(tCoachA))).status).toBe(200);
  });
  it('admin → 200', async () => {
    expect((await request(app).get('/api/admin/students').set(auth(tAdmin))).status).toBe(200);
  });
});

// ============================================
// 2. Endpoints global-admin-only → coach 403
// ============================================
describe('2. Endpoints global-admin-only rechazan a un coach (403)', () => {
  // Cada fila: método, path (con placeholders), body. Se prueba con tCoachA.
  const cases: Array<[string, () => string, Record<string, unknown>?]> = [
    ['get', () => `/api/admin/users/${learnerA1.id}`],
    ['patch', () => `/api/admin/users/${learnerA1.id}`, { firstName: 'x' }],
    ['delete', () => `/api/admin/users/${learnerA1.id}`],
    ['patch', () => `/api/admin/users/${learnerA1.id}/coach`, { coachId: null }],
    ['patch', () => `/api/admin/users/${learnerA1.id}/division`, { divisionId: null }],
    ['post', () => `/api/admin/users/bulk`, { users: [] }],
    ['post', () => `/api/admin/sedes`, { slug: 'nueva', name: 'Nueva' }],
    ['patch', () => `/api/admin/sedes/${sedeA.id}`, { name: 'x' }],
    ['delete', () => `/api/admin/sedes/${sedeB.id}`],
    ['get', () => `/api/admin/sedes/${sedeA.id}`],
    ['get', () => `/api/admin/divisions`],
    // sedeId es un placeholder estático a propósito: el 403 lo dispara
    // requireGlobalAdmin ANTES de validar el body, y referenciar la fixture
    // `sedeA` acá reventaría al construir el array (corre antes del beforeEach).
    ['post', () => `/api/admin/divisions`, { sedeId: '00000000-0000-0000-0000-000000000000', name: 'Div' }],
    ['patch', () => `/api/admin/coaches/${coachA.id}/permissions`, { canEditPrompts: true }],
    ['get', () => `/api/admin/config`],
    ['put', () => `/api/admin/config`, {}],
    ['get', () => `/api/admin/pricing-rates`],
    ['post', () => `/api/admin/pricing-rates`, { service: 'infra', unit: 'monthly', unitPriceUsd: '1' }],
    ['get', () => `/api/admin/experiments`],
    ['get', () => `/api/admin/agent-configs`],
    ['put', () => `/api/admin/agent-configs`, { secretName: 's', agentId: 'a' }],
    ['get', () => `/api/admin/user-scenario-access/${learnerA1.id}`],
    ['put', () => `/api/admin/user-scenario-access/${learnerA1.id}`, { entries: [] }],
    ['get', () => `/api/admin/ai-access`],
    ['put', () => `/api/admin/ai-access`, { locked: true }],
    ['get', () => `/api/admin/agent-latency`],
    ['get', () => `/api/admin/latency-probe`],
  ];

  // El título NO puede llamar a path() en tiempo de colección: los paths
  // referencian fixtures (learnerA1.id, etc.) que sólo existen tras beforeEach.
  // Se resuelve path() dentro del test (async) y el título usa el índice.
  cases.forEach(([method, path, body], i) => {
    it(`caso #${i + 1}: ${method.toUpperCase()} (global-admin-only) → coachA 403`, async () => {
      const req = (request(app) as any)[method](path()).set(auth(tCoachA));
      const res = await (body ? req.send(body) : req);
      expect(res.status).toBe(403);
    });
  });
});

// ============================================
// 3. Aislamiento entre sedes (coach sobre datos de OTRA sede)
// ============================================
describe('3. Aislamiento entre sedes', () => {
  it('GET /students: coachB no ve learners de sede A', async () => {
    const res = await request(app).get('/api/admin/students').set(auth(tCoachB));
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(learnerB.id);
    expect(ids).not.toContain(learnerA1.id);
    expect(ids).not.toContain(learnerA2.id);
  });

  it('PATCH /users/:id/password de otra sede → 404', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${learnerB.id}/password`)
      .set(auth(tCoachA))
      .send({ password: 'nuevapass123' });
    expect(res.status).toBe(404);
  });

  it('PATCH /users/:id/name de otra sede → 404', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${learnerB.id}/name`)
      .set(auth(tCoachA))
      .send({ firstName: 'Hack' });
    expect(res.status).toBe(404);
  });

  it('POST /grades de otra sede → 404', async () => {
    const res = await request(app)
      .post('/api/admin/grades')
      .set(auth(tCoachA))
      .send({ userId: learnerB.id, finalGrade: 100 });
    expect(res.status).toBe(404);
  });

  it('PATCH /users/:id/examen-final sobre NO asignado → 404', async () => {
    // learnerB no es asignado de coachA (toggle es assigned-only).
    const res = await request(app)
      .patch(`/api/admin/users/${learnerB.id}/examen-final`)
      .set(auth(tCoachA))
      .send({ enabled: true, exam: 'prospeccion' });
    expect(res.status).toBe(404);
  });

  it('GET /admin/sessions/:id/transcript de otra sede → 404', async () => {
    const sessB = await seedSession(learnerB.id, { transcript: [{ role: 'user', content: 'secreto' }] });
    const res = await request(app)
      .get(`/api/admin/sessions/${sessB.id}/transcript`)
      .set(auth(tCoachA));
    expect(res.status).toBe(404);
  });

  it('PATCH /users/:id/approval de un pending de otra sede → 404', async () => {
    const pendingB = await seedUser({ email: 'pending-b@ac.test', role: 'learner', sedeId: sedeB.id, status: 'pending' });
    const res = await request(app)
      .patch(`/api/admin/users/${pendingB.id}/approval`)
      .set(auth(tCoachA))
      .send({ decision: 'approve' });
    expect(res.status).toBe(404);
  });
});

// ============================================
// 4. Restricciones de creación de usuarios por coach
// ============================================
describe('4. createUser — restricciones por coach', () => {
  it('coach SIN canCreateCoaches no puede crear ningún usuario → 403', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(tCoachA))
      .send({ email: 'nuevo1@ac.test', password: 'password123', role: 'coach', sedeId: sedeA.id });
    expect(res.status).toBe(403);
  });

  it('coach con canCreateCoaches NO puede crear un learner → 403', async () => {
    const tCreator = await loginAs(coachACreator.email, coachACreator.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(tCreator))
      .send({ email: 'nuevo2@ac.test', password: 'password123', role: 'learner', sedeId: sedeA.id });
    expect(res.status).toBe(403);
  });

  it('coach con canCreateCoaches NO puede crear coach en OTRA sede → 403', async () => {
    const tCreator = await loginAs(coachACreator.email, coachACreator.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(tCreator))
      .send({ email: 'nuevo3@ac.test', password: 'password123', role: 'coach', sedeId: sedeB.id });
    expect(res.status).toBe(403);
  });

  it('coach con canCreateCoaches SÍ puede crear coach en su propia sede → 201', async () => {
    const tCreator = await loginAs(coachACreator.email, coachACreator.password);
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(tCreator))
      .send({ email: 'nuevo4@ac.test', password: 'password123', role: 'coach', sedeId: sedeA.id });
    expect(res.status).toBe(201);
  });
});

// ============================================
// 5. IDOR entre learners en /api/sessions
// ============================================
describe('5. IDOR: un learner no accede a sesiones de otro', () => {
  it('PATCH /api/sessions/:id de otro dueño → 404', async () => {
    const sess = await seedSession(learnerA1.id);
    const res = await request(app)
      .patch(`/api/sessions/${sess.id}`)
      .set(auth(tLearnerB))
      .send({ durationSeconds: 999 });
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions/:id/transcript de otro dueño → 404', async () => {
    const sess = await seedSession(learnerA1.id, { transcript: [{ role: 'user', content: 'privado' }] });
    const res = await request(app)
      .get(`/api/sessions/${sess.id}/transcript`)
      .set(auth(tLearnerB));
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/transcript sobre sesión ajena → 404', async () => {
    const sess = await seedSession(learnerA1.id);
    const res = await request(app)
      .post(`/api/sessions/${sess.id}/transcript`)
      .set(auth(tLearnerB))
      .send({ transcript: [{ role: 'user', content: 'inyectado' }] });
    expect(res.status).toBe(404);
  });

  it('un learner NO puede setear passed:true vía PATCH (whitelist)', async () => {
    const sess = await seedSession(learnerA1.id);
    await request(app)
      .patch(`/api/sessions/${sess.id}`)
      .set(auth(tLearnerA1))
      .send({ passed: true, score: 100 });
    const row = await prisma.practiceSession.findUnique({ where: { id: sess.id } });
    expect(row?.passed).toBe(false); // score/passed jamás se aceptan del cliente
  });
});

// ============================================
// 6. 🔴 VULNERABILIDADES CONFIRMADAS — estos tests DEBEN fallar hasta corregir.
//    Cada uno codifica el comportamiento SEGURO esperado.
// ============================================
describe('6. 🔴 Vulnerabilidades confirmadas (rojo hasta corregir el backend)', () => {
  // --- BUG A: escalada intra-sede vía loadUserScopedOrThrow (no filtra por rol) ---
  it('🔴 BUG A: un coach NO debería poder resetear la contraseña de un ADMIN de su sede', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${adminInSedeA.id}/password`)
      .set(auth(tCoachA))
      .send({ password: 'tomado-por-coach-123' });
    // Seguro: 403/404. Actual: 200 (toma de cuenta del admin).
    expect([403, 404]).toContain(res.status);

    // Aserción "dañina": confirmar que la contraseña realmente NO cambió.
    const login = await request(app)
      .post('/auth/login')
      .send({ email: adminInSedeA.email, password: 'tomado-por-coach-123' });
    expect(login.status).not.toBe(200); // si es 200, el coach tomó la cuenta del admin
  });

  it('🔴 BUG A2: un coach NO debería poder resetear la contraseña de OTRO coach de su sede', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${coachACreator.id}/password`)
      .set(auth(tCoachA))
      .send({ password: 'otro-coach-tomado-123' });
    expect([403, 404]).toContain(res.status);
  });

  // --- BUG B: auto-escalada de nivel/curso sin aprobar examen (api.ts) ---
  it('🔴 BUG B: un learner NO debería auto-completar el curso sin aprobar el examen', async () => {
    const res = await request(app)
      .post('/api/users/me/complete-course')
      .set(auth(tLearnerA1));
    // El OpenAPI dice que requiere examen final aprobado; el handler no lo valida.
    expect(res.status).toBe(403);

    const row = await prisma.user.findUnique({ where: { id: learnerA1.id }, select: { courseCompleted: true } });
    expect(row?.courseCompleted).toBe(false); // si es true, se auto-habilitó el certificado
  });

  it('🔴 BUG B2: un learner NO debería auto-desbloquear Nivel 2 sin aprobar el examen', async () => {
    const res = await request(app)
      .post('/api/users/me/unlock-level2')
      .set(auth(tLearnerA1));
    expect(res.status).toBe(403);

    const row = await prisma.user.findUnique({ where: { id: learnerA1.id }, select: { level2Unlocked: true } });
    expect(row?.level2Unlocked).toBe(false);
  });
});
