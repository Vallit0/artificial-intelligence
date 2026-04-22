import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { generateAccessToken } from '../../src/services/auth.service.js';
import { prisma, resetDatabase } from '../helpers/db.js';

async function createUserWithRole(email: string, role: 'admin' | 'learner') {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'not-used-in-these-tests',
      emailVerified: true,
      roles: { create: { role } },
    },
  });
  const token = generateAccessToken({ id: user.id, email: user.email });
  return { user, token };
}

describe('GET /api/admin/latency-probe', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('requiere autenticación (401 sin token)', async () => {
    const res = await request(app).get('/api/admin/latency-probe');
    expect(res.status).toBe(401);
  });

  it('rechaza a usuarios no-admin con 403', async () => {
    const { token } = await createUserWithRole('learner@example.com', 'learner');
    const res = await request(app)
      .get('/api/admin/latency-probe')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('retorna reporte con probes para admin autenticado', async () => {
    const { token } = await createUserWithRole('admin@example.com', 'admin');
    const res = await request(app)
      .get('/api/admin/latency-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeTypeOf('string');
    expect(res.body.totalMs).toBeTypeOf('number');
    expect(Array.isArray(res.body.probes)).toBe(true);

    const services = res.body.probes.map((p: { service: string }) => p.service).sort();
    expect(services).toEqual(['database', 'elevenlabs']);

    for (const probe of res.body.probes) {
      expect(probe.service).toBeTypeOf('string');
      expect(probe.ok).toBeTypeOf('boolean');
      expect(probe.latencyMs).toBeTypeOf('number');
      expect(probe.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('el probe de database debe estar OK contra la DB de test', async () => {
    const { token } = await createUserWithRole('admin2@example.com', 'admin');
    const res = await request(app)
      .get('/api/admin/latency-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const dbProbe = res.body.probes.find((p: { service: string }) => p.service === 'database');
    expect(dbProbe).toBeDefined();
    expect(dbProbe.ok).toBe(true);
    expect(dbProbe.skipped).toBeUndefined();
  });

  it('servicios sin credenciales se marcan skipped, no como error', async () => {
    const { token } = await createUserWithRole('admin3@example.com', 'admin');
    const res = await request(app)
      .get('/api/admin/latency-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // En el entorno de tests no hay API keys reales configuradas;
    // ElevenLabs debe o responder (si el env lo tiene) o skipped — nunca lanzar 500.
    for (const probe of res.body.probes) {
      if (probe.skipped) {
        expect(probe.ok).toBe(false);
        expect(probe.error).toBeTypeOf('string');
      }
    }
  });
});
