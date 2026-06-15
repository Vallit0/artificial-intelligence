# Pruebas — Backend Señoriales

Suite de pruebas de integración con **Vitest + supertest** que ejerce los endpoints Express contra una Postgres real (contenedor efímero).

## Prerrequisitos

- Docker + Docker Compose
- Puerto `5433` libre en el host (usado por la DB de test; no colisiona con la dev DB en `5432`)
- Dependencias instaladas: `npm install` dentro de `server/`

## Archivos clave

| Archivo | Propósito |
|---|---|
| `docker-compose.test.yml` | Postgres 15 efímero en `5433`, datos en `tmpfs` (se pierden al apagar) |
| `.env.test` | Variables para la suite (DATABASE_URL apunta a `5433`, JWT_SECRET de prueba) |
| `vitest.config.ts` | Configuración de Vitest |
| `tests/globalSetup.ts` | Corre `prisma db push` una vez antes de toda la suite |
| `tests/helpers/db.ts` | `resetDatabase()` para truncar tablas entre tests |
| `tests/integration/*.test.ts` | Tests de integración HTTP |

## Ejecución

```bash
# 1. Levantar la DB de test (solo la primera vez o tras un test:db:down)
npm run test:db:up

# 2. Correr toda la suite (lee .env.test automáticamente)
npm test

# Variantes
npm run test:watch       # modo watch
npm run test:coverage    # reporte de cobertura en coverage/

# 3. Al terminar la sesión (opcional, también se puede dejar corriendo)
npm run test:db:down
```

`globalSetup.ts` aborta si `DATABASE_URL` no contiene `senoriales_test`, para que un test nunca pueda destruir la base de desarrollo.

## Estructura de un test

Cada archivo importa `app` de `src/index.js` (el `app.listen` está gateado por `NODE_ENV !== 'test'`, por eso la importación no abre puerto) y usa `supertest`:

```ts
import request from 'supertest';
import app from '../../src/index.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
});

it('...', async () => {
  const res = await request(app).post('/auth/login').send({ ... });
  expect(res.status).toBe(200);
});
```

## Cobertura actual

- `GET /health` — healthcheck con DB conectada
- `POST /auth/signup`, `/auth/login`, `GET /auth/me` — flujo de auth y validación de JWT
- `POST /api/memory/save`, `/api/memory/retrieve` — server tools de ElevenLabs (validación de input, persistencia, orden por importance, filtrado por categoría)

## Pendientes / siguientes tandas

- `/api/memory/context` (construcción de prompt override)
- `/api/elevenlabs/agent-evaluation` (mockear OpenAI; validar persistencia de summary)
- Tests unitarios puros de servicios que no tocan DB (utils de evaluación, helpers de prompt)

## Bug conocido detectado por la suite

`auth.service.ts::generateRefreshToken` genera JWTs con solo `{ sub, type }` sin `jti`, por lo que dos llamadas en la misma segunda producen el mismo token y `storeRefreshToken` falla con `Unique constraint failed`. Reproducible haciendo signup + login inmediato. Fix sugerido: añadir `jti: crypto.randomUUID()` al payload del refresh token.
