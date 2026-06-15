# Manual técnico — Tests de integración (backend)

> Suite de integración del servidor de Señoriales. Corre sobre **Vitest + supertest**
> contra una instancia **efímera de PostgreSQL**, ejercitando el `app` de Express real
> (rutas + middleware + servicios + Prisma) sin levantar la red de Docker de producción.

---

## 1. Arquitectura de la suite

| Pieza | Archivo | Rol |
|---|---|---|
| Runner / config | `server/vitest.config.ts` | Vitest, entorno `node`, `globals: true` |
| Bootstrap global | `server/tests/globalSetup.ts` | Verifica que apunta a la DB de test y hace `prisma db push` |
| Helpers de DB | `server/tests/helpers/db.ts` | `prisma`, `resetDatabase()`, `ensureTestSede()` |
| Variables de entorno | `server/.env.test` | DB de test (puerto 5433), `JWT_SECRET` de test, API keys vacías |
| Casos | `server/tests/integration/*.test.ts` | suite de integración HTTP |

### Decisiones clave de configuración

- **`fileParallelism: false`** (`vitest.config.ts:11`): los archivos corren en serie. Comparten
  una sola DB, así que paralelizarlos provocaría colisiones de datos.
- **`globalSetup`** aplica el schema una vez con `npx prisma db push --skip-generate --accept-data-loss`
  y **aborta si `DATABASE_URL` no contiene `senoriales_test`** — salvaguarda para no truncar una DB real.
- **`resetDatabase()`** se llama en `beforeEach` de casi todos los `describe`: hace
  `TRUNCATE ... RESTART IDENTITY CASCADE` sobre todas las tablas excepto `_prisma_migrations`.
  Cada test arranca de cero.
- **`testTimeout: 20000` / `hookTimeout: 60000`**: el hook largo cubre el `prisma db push` inicial.
- Las API keys externas (`ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `WHAPI_TOKEN`, `RESEND_API_KEY`)
  van **vacías** en `.env.test`. Los tests que tocan servicios externos **mockean `globalThis.fetch`**
  con `vi.spyOn`; no se hacen llamadas de red reales.

---

## 2. Cómo correrla

### Pre-requisito: DB de test

```powershell
cd server
npm run test:db:up      # docker compose -f docker-compose.test.yml up -d --wait
```

Levanta Postgres en `localhost:5433` (usuario/clave/db = `senoriales_test`), que es justo
lo que apunta `.env.test`.

### Ejecutar

```powershell
cd server
npm test                # corrida única (CI): dotenv -e .env.test -- vitest run
npm run test:watch      # modo watch durante desarrollo
npm run test:coverage   # con cobertura v8 (reporte text + html)
```

### Limpiar

```powershell
npm run test:db:down    # docker compose ... down -v  (borra el volumen)
```

> El schema se sincroniza automáticamente en `globalSetup`. Si necesitas forzarlo a mano:
> `npm run test:db:push`.

---

## 3. Patrones usados en los tests

- **Petición HTTP real**: `request(app).post('/auth/login').send({...})` — supertest monta el server
  Express en memoria, sin puerto.
- **Sembrado directo por Prisma**: helpers `seedUser`, `createSede`, etc.
  crean estado vía `prisma.*` para no depender de los endpoints bajo prueba.
- **Autenticación**: `loginAs(email, password)` hace `POST /auth/login` y devuelve el `accessToken`;
  algunos tests usan `generateAccessToken()` directo del servicio.
- **Aislamiento de estado externo**: mock de `fetch` por test + `_resetTokenCache()`
  para limpiar cachés de módulo entre casos.
- **Aserciones dobles**: se verifica el código HTTP/respuesta **y** el estado en DB (p. ej. que el
  cambio realmente se persistió o que un cascade borró las filas hijas).

---

## 4. Inventario de archivos

| Archivo | Área | Casos |
|---|---|---|
| `auth.test.ts` | Signup / login / sesión | 5 |
| `userManagement.test.ts` | Gestión de usuarios (regresión del stress test) | 18 |
| `sedes.test.ts` | Multi-sede + roles + permisos de coach | 19 |
| `health.test.ts` | Health checks | 3 |
| `latencyProbe.test.ts` | Sonda de latencia (admin) | 5 |
| `memory.test.ts` | Memoria del asesor (server tools de ElevenLabs) | 7 |

---

## 5. Cobertura por funcionalidad (detalle)

### Autenticación (`auth.test.ts`)
- Signup crea usuario y devuelve `accessToken` + `refreshToken`, ligado a su `sedeId`.
- Signup sin `sede` → 400.
- Signup con email duplicado → 409.
- Login correcto → 200 con tokens y roles; credenciales inválidas → 401.
- `GET /auth/me` exige token (401 sin él) y devuelve usuario con sede y roles.

### Gestión de usuarios (`userManagement.test.ts`) — regresiones del stress test
- **Orden de rutas**: `PATCH /api/admin/users/bulk/examen-final` no colisiona con `/:id/examen-final`; valida `userIds` no vacío.
- **Bulk create**: exige `sedeId` (por-user o default); crea N con `defaultSedeId`; deduplica emails dentro del lote (P2002); rechaza passwords < 12 chars; coach **no** puede hacer bulk.
- **Single create + autorización**: coach (incluso con `canCreateCoaches`) no crea admin ni learner; sí crea coach en su sede; coach sin permiso no crea coach; admin crea coach con permisos en `false`; rechaza password corta; rechaza email duplicado (409).
- **Delete**: admin no puede auto-borrarse; admin borra learner con cascade de roles/sesiones; coach no puede borrar.

### Multi-sede y permisos (`sedes.test.ts`)
- **Aislamiento duro**: coach de sede A solo ve learners de A; admin global ve todas; coach de A no modifica learner de B (**404** para no filtrar existencia) pero sí los de su sede; coach no borra.
- **Creación de coaches**: signup público nunca asigna rol coach (ignora injection); reglas de `canCreateCoaches` por sede; admin global crea en cualquier sede; cambio de permisos solo por admin.
- **Edición de prompts**: requiere `canEditPrompts` o admin (403 si no).
- **CRUD de sedes**: `GET /api/sedes` público sin campos sensibles; crear/borrar solo admin; borrar sede con usuarios → 409.

### Health (`health.test.ts`)
- `GET /health/live` siempre 200.
- `GET /health/ready` 200 con DB arriba (check `database = up`, `environment = test`).
- `GET /health` mantiene formato `ready` (compatibilidad).

### Latency probe (`latencyProbe.test.ts`)
- `GET /api/admin/latency-probe`: 401 sin token, 403 no-admin.
- Admin: reporte con `timestamp/totalMs/probes`; probes de `database` y `elevenlabs`.
- Probe de `database` OK contra la DB de test.
- Servicios sin credenciales se marcan `skipped` (no 500).

### Memoria del asesor (`memory.test.ts`)
- `POST /api/memory/save`: 400 sin campos requeridos o categoría inválida; crea y persiste memoria; clampa `importance` a 1..10.
- `POST /api/memory/retrieve`: 400 sin `user_id`; devuelve memorias ordenadas por `importance` desc; filtra por categoría.

---

## 6. Qué NO cubre la suite (gaps conocidos)

- **Migraciones de schema**: no hay tests que validen `prisma migrate`. El schema se aplica con
  `db push` en setup; una migración rota no se detectaría aquí.
- **Sesiones de práctica / evaluación con OpenAI**: `POST /api/sessions/evaluate` no está cubierto.
- **ElevenLabs real**: tokens de conversación / transcripción solo se tocan como probe `skipped`.
- **WhatsApp (WHAPI) y email (Resend)**: sin cobertura de integración.
- **Frontend (React)**: no hay tests de UI/componentes en esta suite.
- **Carga/concurrencia**: cubierto aparte por `stress/` y `tests/load/` (no por Vitest).
