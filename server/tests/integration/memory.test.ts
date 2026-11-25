import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma, resetDatabase } from '../helpers/db.js';

async function createUser(email = 'memtest@example.com') {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'not-used-in-these-tests',
      emailVerified: true,
    },
  });
}

describe('Memory endpoints (ElevenLabs server tools)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/memory/save', () => {
    it('falla con 400 si faltan campos requeridos', async () => {
      const res = await request(app)
        .post('/api/memory/save')
        .send({ user_id: 'anything' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('falla con 400 si la categoría es inválida', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/memory/save').send({
        user_id: user.id,
        content: 'usa demasiadas muletillas',
        category: 'categoria-inexistente',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/category/i);
    });

    it('crea una memoria y la persiste', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/memory/save').send({
        user_id: user.id,
        content: 'Cierra prematuramente sin manejar objeciones',
        category: 'debilidad',
        importance: 7,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.memory_id).toBeTypeOf('string');

      const stored = await prisma.advisorMemory.findUnique({
        where: { id: res.body.memory_id },
      });
      expect(stored).not.toBeNull();
      expect(stored?.category).toBe('debilidad');
      expect(stored?.importance).toBe(7);
    });

    it('clampa importance al rango 1..10', async () => {
      const user = await createUser();
      const res = await request(app).post('/api/memory/save').send({
        user_id: user.id,
        content: 'Importancia fuera de rango',
        category: 'progreso',
        importance: 99,
      });

      expect(res.status).toBe(200);
      const stored = await prisma.advisorMemory.findUnique({
        where: { id: res.body.memory_id },
      });
      expect(stored?.importance).toBe(10);
    });
  });

  describe('POST /api/memory/retrieve', () => {
    // Corre a mitad de conversación con "Wait for response": nunca debe
    // responder con error (colgaría el turno del agente). Sin user_id degrada a
    // una memoria vacía con 200 en vez de 400.
    it('degrada a memoria vacía (200) sin user_id', async () => {
      const res = await request(app).post('/api/memory/retrieve').send({});
      expect(res.status).toBe(200);
      expect(res.body.memories).toEqual([]);
      expect(res.body.last_session).toBeNull();
    });

    it('devuelve memorias ordenadas por importance desc', async () => {
      const user = await createUser();

      await prisma.advisorMemory.createMany({
        data: [
          { userId: user.id, content: 'baja', category: 'debilidad', importance: 2, source: 'agent' },
          { userId: user.id, content: 'alta', category: 'debilidad', importance: 9, source: 'agent' },
          { userId: user.id, content: 'media', category: 'fortaleza', importance: 5, source: 'agent' },
        ],
      });

      const res = await request(app)
        .post('/api/memory/retrieve')
        .send({ user_id: user.id });

      expect(res.status).toBe(200);
      expect(res.body.memories).toHaveLength(3);
      expect(res.body.memories[0].importance).toBe(9);
      expect(res.body.memories[0].content).toBe('alta');
      expect(res.body.last_session).toBeNull();
    });

    it('filtra por categoría cuando se especifica', async () => {
      const user = await createUser();

      await prisma.advisorMemory.createMany({
        data: [
          { userId: user.id, content: 'w1', category: 'debilidad', importance: 5, source: 'agent' },
          { userId: user.id, content: 's1', category: 'fortaleza', importance: 5, source: 'agent' },
        ],
      });

      const res = await request(app)
        .post('/api/memory/retrieve')
        .send({ user_id: user.id, category: 'fortaleza' });

      expect(res.status).toBe(200);
      expect(res.body.memories).toHaveLength(1);
      expect(res.body.memories[0].category).toBe('fortaleza');
    });
  });
});
