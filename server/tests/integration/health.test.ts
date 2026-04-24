import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';

describe('Health endpoints', () => {
  it('GET /health/live responde 200 siempre', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready responde 200 con la DB arriba', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBe('test');

    const db = res.body.checks.find((c: { name: string }) => c.name === 'database');
    expect(db?.status).toBe('up');
  });

  it('GET /health mantiene el formato ready para compatibilidad', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.checks).toBeInstanceOf(Array);
  });
});
