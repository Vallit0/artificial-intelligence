// ============================================
// Memory Routes (ElevenLabs Server Tools)
// ============================================

import { Router } from 'express';
import * as memoryController from '../controllers/memory.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireToolSecret } from '../middleware/toolSecret.js';

export const memoryRouter = Router();

// Server-tool endpoints — called directly by ElevenLabs Server Tools.
// Protected by a shared secret (X-Tool-Secret header) instead of user JWT.

/**
 * @openapi
 * /api/memory/retrieve:
 *   post:
 *     tags: [Memory]
 *     summary: Recupera las memorias del asesor (ElevenLabs Server Tool)
 *     description: >-
 *       Invocado directamente por el runtime server-side de ElevenLabs (no por un usuario logueado).
 *       No usa JWT de usuario: se autentica con el header compartido `X-Tool-Secret`.
 *       Devuelve las memorias ordenadas por importance descendente (luego por updatedAt desc) más el resumen
 *       de la última sesión del asesor.
 *       Como se invoca a mitad de conversación con "Wait for response", NUNCA responde con error: ante un
 *       secreto inválido/ausente, `user_id` faltante o un fallo interno degrada a `{ memories: [], last_session: null }`
 *       (HTTP 200) para no colgar el turno del agente. Con el secreto correcto devuelve la memoria real.
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Tool-Secret
 *         required: false
 *         schema: { type: string }
 *         description: >-
 *           Secreto compartido con ElevenLabs (TOOL_SHARED_SECRET). Si falta o no coincide, la respuesta
 *           es una memoria vacía (200) en lugar de un 401, para no colgar la conversación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id: { type: string, format: uuid, description: ID del asesor cuyas memorias se recuperan }
 *               category:
 *                 type: string
 *                 enum: [debilidad, fortaleza, expresion, comportamiento, progreso]
 *                 description: Filtra las memorias por categoría. Si se omite, devuelve todas.
 *               limit: { type: integer, default: 20, description: Número máximo de memorias a devolver }
 *     responses:
 *       200:
 *         description: Memorias del asesor + resumen de la última sesión
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       content: { type: string }
 *                       category:
 *                         type: string
 *                         enum: [debilidad, fortaleza, expresion, comportamiento, progreso]
 *                       importance: { type: integer, minimum: 1, maximum: 10 }
 *                       created_at: { type: string, format: date-time }
 *                 last_session:
 *                   nullable: true
 *                   type: object
 *                   description: Resumen de la sesión más reciente, o null si no hay ninguna.
 *                   properties:
 *                     summary: { type: string }
 *                     score: { type: integer, nullable: true }
 *                     scenario: { type: string, nullable: true }
 *                     strengths: { type: string, nullable: true }
 *                     weaknesses: { type: string, nullable: true }
 *                     recommendation: { type: string, nullable: true }
 *                     date: { type: string, format: date-time }
 */
// /retrieve corre a mitad de conversación (Wait for response). NO usa el
// middleware requireToolSecret porque un 401/500 colgaría el turno del agente;
// el controller valida el secreto internamente y degrada a memoria vacía (200)
// ante cualquier fallo. /save sí bloquea con el middleware (ver abajo).
memoryRouter.post('/retrieve', memoryController.retrieve);

/**
 * @openapi
 * /api/memory/save:
 *   post:
 *     tags: [Memory]
 *     summary: Guarda una memoria del asesor (ElevenLabs Server Tool)
 *     description: >-
 *       Invocado por ElevenLabs durante la conversación para persistir un aprendizaje sobre el asesor.
 *       No usa JWT de usuario: se autentica con el header compartido `X-Tool-Secret`.
 *       Si ya existe una memoria similar (misma categoría y contenido con prefijo coincidente) se actualiza
 *       incrementando su importance en 1 (máximo 10) en lugar de crear un duplicado. El campo `importance`
 *       se acota al rango 1..10; si se omite se usa 5. La fuente (`source`) siempre se registra como "agent".
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Tool-Secret
 *         required: true
 *         schema: { type: string }
 *         description: Secreto compartido con ElevenLabs (TOOL_SHARED_SECRET). En dev puede omitirse si la variable no está configurada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, content, category]
 *             properties:
 *               user_id: { type: string, format: uuid, description: ID del asesor al que pertenece la memoria }
 *               content: { type: string, description: Texto del aprendizaje a recordar }
 *               category:
 *                 type: string
 *                 enum: [debilidad, fortaleza, expresion, comportamiento, progreso]
 *                 description: Categoría de la memoria. Cualquier otro valor produce 400.
 *               importance:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 5
 *                 description: Relevancia de la memoria. Se acota al rango 1..10.
 *     responses:
 *       200:
 *         description: Memoria creada o actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 memory_id: { type: string, format: uuid }
 *       400: { description: 'Faltan campos requeridos (user_id, content, category) o la categoría es inválida', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: 'Secreto de tool inválido', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: 'Secreto de tool no configurado (solo en producción)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
memoryRouter.post('/save', requireToolSecret, memoryController.save);

/**
 * @openapi
 * /api/memory/context:
 *   post:
 *     tags: [Memory]
 *     summary: Construye el contexto de override del agente para el frontend
 *     description: >-
 *       Invocado por el frontend (con JWT de usuario) para obtener el texto de contexto que se inyecta como
 *       override del prompt del agente. El `user_id` del body debe coincidir con el usuario autenticado;
 *       de lo contrario se devuelve 403 (prevención de IDOR). Devuelve cadena vacía si el asesor no tiene
 *       memorias ni sesiones previas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id: { type: string, format: uuid, description: ID del usuario autenticado (debe coincidir con el del token) }
 *     responses:
 *       200:
 *         description: Contexto del agente (texto plano, posiblemente vacío)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 context: { type: string }
 *       400: { description: 'Falta user_id', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado }
 *       403: { description: 'Intento de leer el contexto de otro usuario', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
memoryRouter.post('/context', authMiddleware, memoryController.getContext);
