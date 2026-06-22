// ============================================
// Flujo de Examen Final — Nivel 1 (Prospección) y Nivel 2 (Objeciones)
// ============================================
//
// Cubre el camino completo que recorren ambos exámenes finales desde el
// backend, sin tocar ElevenLabs/OpenAI (esos son externos):
//
//   POST /api/sessions                      → crea la sesión de examen
//   PATCH /api/sessions/:id                 → guarda duración + latencia
//   POST /api/sessions/:id/transcript       → guarda el transcript
//   POST /api/elevenlabs/agent-evaluation   → la nota (recompute server-side)
//   POST /api/users/me/unlock-level2        → desbloquea Nivel 2 (examen 1)
//   POST /api/users/me/complete-course      → marca curso completo (examen 2)
//
// Foco principal: que score/passed se computen SIEMPRE server-side desde el
// breakdown (anti-trampa) y que la propiedad de la sesión esté blindada (IDOR).

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase, ensureTestSede } from '../helpers/db.js';
import { hashPassword } from '../../src/utils/passwordHash.js';

const PASSWORD = 'examflow-pass-123';

async function seedLearner(email: string, sedeId: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      sedeId,
      roles: { create: { role: 'learner' } },
    },
  });
  return { id: user.id, email };
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login ${email} falló: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

// Breakdown que suma exactamente `total` repartido en los 5 rubros (0-20 c/u).
// El umbral de aprobación es 75 (PASS_THRESHOLD en el controller).
function breakdownFor(total: number) {
  const base = Math.floor(total / 5);
  const rem = total - base * 5;
  const parts = [base, base, base, base, base + rem]; // último absorbe el resto
  return {
    apertura: parts[0],
    escucha_activa: parts[1],
    manejo_objeciones: parts[2],
    propuesta_valor: parts[3],
    cierre: parts[4],
  };
}

async function createExamSession(token: string, examType: 'prospeccion' | 'objeciones') {
  // Igual que el frontend (ExamenFinal / ExamenFinalObjeciones): el examen se
  // identifica solo por examType; practiceMode queda en null. Ojo: 'prospeccion'
  // NO es un practiceMode válido del schema (el enum es cliente /
  // cliente_prospeccion / asesor / objeciones / coach), así que mandarlo daría 400.
  const res = await request(app)
    .post('/api/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({ examType, durationSeconds: 0 });
  return res;
}

describe('Flujo de Examen Final (Nivel 1 y Nivel 2)', () => {
  let sede: { id: string };
  let learner: { id: string; email: string };
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    sede = await ensureTestSede();
    learner = await seedLearner('examflow@test.local', sede.id);
    token = await loginAs(learner.email);
  });

  // ============================================
  // Creación de sesión de examen
  // ============================================
  describe('POST /api/sessions (sesión de examen)', () => {
    it('crea sesión de Prospección (examType=prospeccion) sin score y no aprobada', async () => {
      const res = await createExamSession(token, 'prospeccion');
      expect(res.status).toBe(201);
      expect(res.body.examType).toBe('prospeccion');
      expect(res.body.passed).toBe(false);
      expect(res.body.score ?? null).toBeNull();
      expect(res.body.scenarioId ?? null).toBeNull(); // examen = sin escenario
    });

    it('crea sesión de Objeciones (examType=objeciones)', async () => {
      const res = await createExamSession(token, 'objeciones');
      expect(res.status).toBe(201);
      expect(res.body.examType).toBe('objeciones');
      expect(res.body.passed).toBe(false);
    });

    it('rechaza examType inválido con 400', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ examType: 'no-existe' });
      expect(res.status).toBe(400);
    });

    it('requiere autenticación (401 sin token)', async () => {
      const res = await request(app).post('/api/sessions').send({ examType: 'prospeccion' });
      expect(res.status).toBe(401);
    });

    it('el cliente NO puede auto-asignarse score/passed al crear', async () => {
      // score/passed están fuera del whitelist del createSessionSchema: aunque
      // se envíen, se ignoran (la sesión nace con passed=false, score=null).
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ examType: 'prospeccion', score: 100, passed: true });
      expect(res.status).toBe(201);
      expect(res.body.passed).toBe(false);
      expect(res.body.score ?? null).toBeNull();
    });
  });

  // ============================================
  // Evaluación del agente — recompute server-side
  // ============================================
  describe('POST /api/elevenlabs/agent-evaluation (nota)', () => {
    async function evalSession(t: string, sessionId: string, body: Record<string, unknown>) {
      return request(app)
        .post('/api/elevenlabs/agent-evaluation')
        .set('Authorization', `Bearer ${t}`)
        .send({ sessionId, feedback: 'Comentario del agente.', ...body });
    }

    it('aprueba cuando el breakdown suma ≥75 y persiste score + breakdown', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await evalSession(token, session.id, { breakdown: breakdownFor(90) });

      expect(res.status).toBe(200);
      expect(res.body.evaluation.score).toBe(90);
      expect(res.body.evaluation.passed).toBe(true);

      const row = await prisma.practiceSession.findUnique({
        where: { id: session.id },
        include: { evaluationBreakdown: true },
      });
      expect(row?.passed).toBe(true);
      expect(row?.score).toBe(90);
      expect(row?.evaluationBreakdown).not.toBeNull();
      const sum =
        (row!.evaluationBreakdown!.apertura) +
        (row!.evaluationBreakdown!.escuchaActiva) +
        (row!.evaluationBreakdown!.manejoObjeciones) +
        (row!.evaluationBreakdown!.propuestaValor) +
        (row!.evaluationBreakdown!.cierre);
      expect(sum).toBe(90);
    });

    it('reprueba cuando el breakdown suma <75', async () => {
      const session = (await createExamSession(token, 'objeciones')).body;
      const res = await evalSession(token, session.id, { breakdown: breakdownFor(50) });
      expect(res.status).toBe(200);
      expect(res.body.evaluation.score).toBe(50);
      expect(res.body.evaluation.passed).toBe(false);

      const row = await prisma.practiceSession.findUnique({ where: { id: session.id } });
      expect(row?.passed).toBe(false);
    });

    it('frontera del umbral: 75 aprueba, 74 reprueba', async () => {
      const s75 = (await createExamSession(token, 'prospeccion')).body;
      const r75 = await evalSession(token, s75.id, { breakdown: breakdownFor(75) });
      expect(r75.body.evaluation.passed).toBe(true);
      expect(r75.body.evaluation.score).toBe(75);

      const s74 = (await createExamSession(token, 'prospeccion')).body;
      const r74 = await evalSession(token, s74.id, { breakdown: breakdownFor(74) });
      expect(r74.body.evaluation.passed).toBe(false);
      expect(r74.body.evaluation.score).toBe(74);
    });

    it('IGNORA score/passed que mande el cliente y recomputa desde el breakdown', async () => {
      // Vector anti-trampa: el agente (o un cliente malicioso) afirma passed:true
      // y score:100, pero el breakdown real suma 40. Debe quedar reprobado.
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await evalSession(token, session.id, {
        score: 100,
        passed: true,
        breakdown: breakdownFor(40),
      });
      expect(res.status).toBe(200);
      expect(res.body.evaluation.score).toBe(40);
      expect(res.body.evaluation.passed).toBe(false);

      const row = await prisma.practiceSession.findUnique({ where: { id: session.id } });
      expect(row?.passed).toBe(false);
      expect(row?.score).toBe(40);
    });

    it('rechaza un rubro fuera de rango (>20) con 400', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await evalSession(token, session.id, {
        breakdown: { apertura: 25, escucha_activa: 10, manejo_objeciones: 10, propuesta_valor: 10, cierre: 10 },
      });
      expect(res.status).toBe(400);
    });

    it('rechaza feedback vacío con 400', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await request(app)
        .post('/api/elevenlabs/agent-evaluation')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: session.id, feedback: '', breakdown: breakdownFor(80) });
      expect(res.status).toBe(400);
    });

    it('IDOR: un usuario NO puede evaluar la sesión de otro (404)', async () => {
      const victimSession = (await createExamSession(token, 'prospeccion')).body;

      const attacker = await seedLearner('attacker@test.local', sede.id);
      const attackerToken = await loginAs(attacker.email);

      const res = await evalSession(attackerToken, victimSession.id, { breakdown: breakdownFor(100) });
      expect(res.status).toBe(404);

      // La sesión de la víctima sigue intacta (no aprobada).
      const row = await prisma.practiceSession.findUnique({ where: { id: victimSession.id } });
      expect(row?.passed).toBe(false);
    });

    it('requiere autenticación (401 sin token)', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await request(app)
        .post('/api/elevenlabs/agent-evaluation')
        .send({ sessionId: session.id, feedback: 'x', breakdown: breakdownFor(80) });
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // PATCH + transcript — ownership
  // ============================================
  describe('PATCH /api/sessions/:id y transcript (propiedad)', () => {
    it('actualiza duración + latencia de la sesión propia', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;
      const res = await request(app)
        .patch(`/api/sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ durationSeconds: 123, connectMs: 800, ttfaSamplesMs: [1200, 1500] });
      expect(res.status).toBe(200);
      expect(res.body.durationSeconds).toBe(123);
    });

    it('guarda el transcript de la sesión propia', async () => {
      const session = (await createExamSession(token, 'objeciones')).body;
      const res = await request(app)
        .post(`/api/sessions/${session.id}/transcript`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          transcript: [
            { role: 'user', content: 'Hola', timestamp: 1 },
            { role: 'agent', content: 'Buenas', timestamp: 2 },
          ],
        });
      expect(res.status).toBe(200);
      const row = await prisma.practiceSession.findUnique({ where: { id: session.id } });
      expect(Array.isArray(row?.transcript)).toBe(true);
    });

    it('IDOR: no se puede patchear la sesión de otro (404)', async () => {
      const victimSession = (await createExamSession(token, 'prospeccion')).body;
      const attacker = await seedLearner('attacker2@test.local', sede.id);
      const attackerToken = await loginAs(attacker.email);
      const res = await request(app)
        .patch(`/api/sessions/${victimSession.id}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ durationSeconds: 999 });
      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // Progresión: unlock Nivel 2 y completar curso
  // ============================================
  describe('Progresión post-examen', () => {
    it('unlock-level2 setea level2Unlocked=true en la DB', async () => {
      const res = await request(app)
        .post('/api/users/me/unlock-level2')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.level2Unlocked).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: learner.id } });
      expect(user?.level2Unlocked).toBe(true);
    });

    it('complete-course setea courseCompleted=true y es idempotente', async () => {
      const first = await request(app)
        .post('/api/users/me/complete-course')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(first.status).toBe(200);
      expect(first.body.courseCompleted).toBe(true);

      // Segunda llamada: mismo resultado, sin error.
      const second = await request(app)
        .post('/api/users/me/complete-course')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(second.status).toBe(200);
      expect(second.body.courseCompleted).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: learner.id } });
      expect(user?.courseCompleted).toBe(true);
    });

    it('ambos endpoints de progresión requieren auth (401)', async () => {
      const a = await request(app).post('/api/users/me/unlock-level2').send({});
      const b = await request(app).post('/api/users/me/complete-course').send({});
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
    });

    // ⚠️ HALLAZGO (gap conocido): unlock-level2 y complete-course NO verifican
    // que exista una sesión de examen aprobada — setean el flag directamente.
    // Hoy la compuerta es sólo del frontend (ExamenFinal espera awaitEvaluation
    // antes de llamar). Este test DOCUMENTA el comportamiento actual para que
    // quede registrado; si se agrega validación server-side, debe invertirse.
    it('GAP: unlock-level2 desbloquea aunque NO haya examen aprobado', async () => {
      const sinExamen = await seedLearner('sin-examen@test.local', sede.id);
      const t = await loginAs(sinExamen.email);

      const passedSessions = await prisma.practiceSession.count({
        where: { userId: sinExamen.id, passed: true },
      });
      expect(passedSessions).toBe(0); // no rindió nada

      const res = await request(app)
        .post('/api/users/me/unlock-level2')
        .set('Authorization', `Bearer ${t}`)
        .send({});
      // Comportamiento ACTUAL: desbloquea igual. (Idealmente debería ser 403.)
      expect(res.status).toBe(200);
      expect(res.body.level2Unlocked).toBe(true);
    });
  });

  // ============================================
  // Camino feliz end-to-end por examen
  // ============================================
  describe('End-to-end', () => {
    it('Examen Prospección: crear → transcript → aprobar → unlock Nivel 2', async () => {
      const session = (await createExamSession(token, 'prospeccion')).body;

      await request(app)
        .patch(`/api/sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ durationSeconds: 240, connectMs: 700, ttfaSamplesMs: [1100] })
        .expect(200);

      await request(app)
        .post(`/api/sessions/${session.id}/transcript`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transcript: [{ role: 'user', content: 'Buenas tardes', timestamp: 1 }] })
        .expect(200);

      const evalRes = await request(app)
        .post('/api/elevenlabs/agent-evaluation')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: session.id, feedback: 'Bien manejada la apertura.', breakdown: breakdownFor(85) });
      expect(evalRes.body.evaluation.passed).toBe(true);

      const unlock = await request(app)
        .post('/api/users/me/unlock-level2')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(unlock.body.level2Unlocked).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: learner.id } });
      expect(user?.level2Unlocked).toBe(true);
    });

    it('Examen Objeciones: crear → aprobar → completar curso', async () => {
      const session = (await createExamSession(token, 'objeciones')).body;

      const evalRes = await request(app)
        .post('/api/elevenlabs/agent-evaluation')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: session.id, feedback: 'Buen manejo de objeciones.', breakdown: breakdownFor(95) });
      expect(evalRes.body.evaluation.passed).toBe(true);

      const complete = await request(app)
        .post('/api/users/me/complete-course')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(complete.body.courseCompleted).toBe(true);

      const row = await prisma.practiceSession.findUnique({ where: { id: session.id } });
      expect(row?.examType).toBe('objeciones');
      expect(row?.passed).toBe(true);
    });
  });
});
