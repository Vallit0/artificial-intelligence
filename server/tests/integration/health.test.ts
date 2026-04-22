import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';

describe('GET /health', () => {
  it('responde 200 con status ok cuando la DB está conectada', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe('connected');
    expect(res.body.environment).toBe('test');
  });
});
