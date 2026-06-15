# Referencia de API (OpenAPI)

La API REST del backend está documentada con **OpenAPI 3.0.3**, generada en tiempo de arranque con `swagger-jsdoc` a partir de anotaciones `@openapi` en los routers (`server/src/routes/*.ts`).

## Acceso

| Recurso | URL (local) | URL (prod) |
|---|---|---|
| **Swagger UI** (interactivo) | `http://localhost:3000/api/docs` | `https://centro-de-negocios.org/api/docs` |
| **Spec crudo** (JSON) | `http://localhost:3000/api/docs.json` | `https://centro-de-negocios.org/api/docs.json` |

!!! tip "Autenticación en Swagger UI"
    La mayoría de endpoints requieren `Authorization: Bearer <accessToken>`. En Swagger UI usa el botón **Authorize** y pega el `accessToken` que devuelve `POST /auth/login`. La sesión persiste (`persistAuthorization`).

## Referencia navegable (Redoc)

Página estática autocontenida —no requiere que el backend esté corriendo— generada desde el mismo spec:

[:material-open-in-new: Abrir referencia completa](api-reference.html){ .md-button .md-button--primary target=_blank }
[:material-code-json: Descargar `openapi.json`](openapi.json){ .md-button target=_blank }

<iframe src="api-reference.html" title="Referencia OpenAPI (Redoc)" style="width:100%;height:75vh;border:1px solid var(--md-default-fg-color--lightest);border-radius:.2rem;margin-top:1rem"></iframe>

## Cobertura

Operaciones documentadas, distribuidas por tag:

| Tag | Operaciones | Descripción |
|---|---|---|
| `Admin` | 41 | Gestión de usuarios, coaches, configs de agente, A/B testing, latency probe |
| `Auth` | 7 | Registro, login, refresh, perfil, reset de password |
| `Sessions` | 6 | Sesiones de práctica + evaluación + transcript |
| `Citas` | 6 | Agendamiento y gestión de citas |
| `Sedes` | 5 | CRUD de sedes (admin global) |
| `Scenarios` | 3 | Escenarios de objeción/llamada |
| `Progress` | 3 | Progreso y estadísticas del usuario |
| `Memory` | 3 | Memoria del asesor (server tools de ElevenLabs) |
| `Analytics` | 2 | Analíticas de desempeño y competencias |
| `Users` | 2 | Acciones del usuario sobre su cuenta + sedes públicas |
| `ElevenLabs` | 2 | Tokens de conversación y transcripción |

## Cómo se mantiene

Las anotaciones viven **junto al código** que documentan, como comentarios JSDoc `@openapi` encima de cada registro de ruta. Al agregar o cambiar un endpoint, actualiza su bloque en el router correspondiente:

```ts
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión y devuelve tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/AuthTokens' } } } }
 *       401: { description: Credenciales inválidas, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
authRouter.post('/login', authLimiter, authController.login);
```

### Schemas reutilizables

Definidos en `server/src/swagger.ts` (`components.schemas`), referenciables con `$ref: '#/components/schemas/X'`:

`Error` · `AuthUser` · `AuthTokens` · `PracticeSession` · `EvaluationResult` · `Scenario` · `AgentLatencyAggregate` · `UserProgress`

### Convenciones

- Rutas **públicas** (signup, login, server tools de memoria): `security: []`.
- Rutas **protegidas**: heredan `bearerAuth` global — no hace falta declararlo.
- Endpoints *sede-aware* devuelven **404** (no 403) al acceder a recursos de otra sede, para no filtrar su existencia.
- Documenta los status codes **reales** (200/201/400/401/403/404/409/410/429/503) según el comportamiento del controlador.

!!! note "Verificación"
    El spec se valida con `swagger-jsdoc` en el arranque y con `tsc --noEmit`. Un error de YAML en una anotación hace que esa operación se omita silenciosamente del spec — revisa `GET /api/docs.json` tras cambios grandes.

### Regenerar los artefactos estáticos

`docs/openapi.json` y `docs/api-reference.html` (Redoc) son **generados**. Tras cambiar anotaciones, regéncralos para que la wiki refleje el spec actual:

```bash
cd server
npm run docs:openapi   # solo el JSON → docs/openapi.json
npm run docs:redoc     # JSON + HTML Redoc → docs/api-reference.html
```
