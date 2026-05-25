// ============================================
// Admin Routes
// ============================================

import { Router, Response, NextFunction, raw } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { requireGlobalAdmin, canEditPrompts } from '../middleware/sedeScope.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import * as adminService from '../services/admin.service.js';
import * as sedesService from '../services/sedes.service.js';
import * as coachesService from '../services/coaches.service.js';
import * as agentConfigService from '../services/agentConfig.service.js';
import * as prospectingScenariosService from '../services/prospectingScenarios.service.js';
import * as sessionsService from '../services/sessions.service.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as abTestingController from '../controllers/abTesting.controller.js';
import * as aiAccessService from '../services/aiAccess.service.js';
import * as latencyProbeService from '../services/latencyProbe.service.js';
import { submitScoreForUser } from '../services/ags.service.js';
import { syncCourse, resolvePendingMatch, dismissPendingMatch } from '../services/ltiSync.service.js';
import { runNrpsSyncTick } from '../services/ltiSyncCron.service.js';
import prisma from '../db/index.js';

export const adminRouter = Router();

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Todas las rutas bajo /api/admin requieren rol admin (bearer token + role admin).
 */

// Todas las rutas bajo /api/admin requieren autenticación. Algunas son
// global-admin only (ver requireGlobalAdmin más abajo); otras (e.g. las de
// estudiantes/sesiones) ahora también admiten coach, con filtros sede-aware
// aplicados en el service. La restricción admin-only general se quita acá
// y se aplica endpoint por endpoint según el caso.
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin', 'coach'));

/**
 * @openapi
 * /api/admin/students:
 *   get:
 *     tags: [Admin]
 *     summary: Lista todos los estudiantes con métricas agregadas
 *     responses:
 *       200: { description: Estudiantes }
 *       403: { description: No es admin }
 */
adminRouter.get('/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const students = await adminService.getAllStudents(req.user!);
    res.json(students);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/users - Create single user
// ============================================
/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Crea un usuario individual
 *     description: >-
 *       Admin global puede crear cualquier rol en cualquier sede. Un coach con
 *       `canCreateCoaches` sólo puede crear coaches en su propia sede; cualquier
 *       otro intento devuelve 403. La sede (`sedeId` o `sede`, UUID o slug) es
 *       obligatoria y debe estar activa.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12 }
 *               sedeId: { type: string, description: UUID o slug de la sede (requerido) }
 *               sede: { type: string, description: Alias de sedeId }
 *               role: { type: string, enum: [learner, coach, instructor, admin], default: learner }
 *               isAdmin: { type: boolean, description: Legacy — equivale a role=admin }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phoneNumber: { type: string }
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     role: { type: string }
 *                     sedeId: { type: string, format: uuid }
 *       400: { description: Email inválido, contraseña corta, sede inválida/inactiva o rol inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Sin permiso para crear este rol o en esta sede, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: El email ya está registrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createUser(req.body, req.user!);
    res.status(201).json({ success: true, user: result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/users/bulk - Bulk create users (admin global only)
// ============================================
/**
 * @openapi
 * /api/admin/users/bulk:
 *   post:
 *     tags: [Admin]
 *     summary: Crea usuarios en lote (sólo admin global)
 *     description: >-
 *       Crea hasta 100 usuarios con rol `learner`. Cada item puede traer su
 *       propio `sedeId`/`sede` (UUID o slug); si no, se usa el `sedeId`/`sede`
 *       del cuerpo como default. Procesa fila por fila y devuelve un resumen
 *       con éxitos y fallos individuales (un email duplicado o contraseña corta
 *       falla esa fila sin abortar el lote).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [users]
 *             properties:
 *               sedeId: { type: string, description: Sede default (UUID o slug) para items sin sede propia }
 *               sede: { type: string, description: Alias de sedeId }
 *               users:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [email, password]
 *                   properties:
 *                     email: { type: string, format: email }
 *                     password: { type: string, minLength: 12 }
 *                     sedeId: { type: string }
 *                     sede: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *     responses:
 *       200:
 *         description: Resumen del lote
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     created: { type: integer }
 *                     failed: { type: integer }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       email: { type: string }
 *                       success: { type: boolean }
 *                       error: { type: string }
 *       400: { description: Array de usuarios faltante, vacío o con más de 100 entradas, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/users/bulk', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.bulkCreateUsers(req.body.users, req.user!, req.body.sedeId ?? req.body.sede);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// DELETE /api/admin/users/:id (admin global only)
// ============================================
/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Elimina un usuario (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400: { description: No puedes eliminar tu propia cuenta, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/users/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.deleteUser(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/admin/users/:id/password
// ============================================
/**
 * @openapi
 * /api/admin/users/{id}/password:
 *   patch:
 *     tags: [Admin]
 *     summary: Cambia la contraseña de un usuario
 *     description: >-
 *       Admin global puede cambiar cualquier contraseña; un coach sólo la de
 *       usuarios de su misma sede (si no, devuelve 404 para no filtrar
 *       existencia entre sedes). Mínimo 6 caracteres.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400: { description: Contraseña con menos de 6 caracteres, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado o fuera del scope del coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.patch('/users/:id/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.updateUserPassword(req.params.id, req.body.password, req.user!);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/admin/users/:id/name
// ============================================
/**
 * @openapi
 * /api/admin/users/{id}/name:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualiza nombre y apellido de un usuario
 *     description: >-
 *       Admin global sobre cualquier usuario; coach sólo sobre usuarios de su
 *       misma sede (si no, 404).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, nullable: true }
 *               lastName: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Nombre actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 id: { type: string, format: uuid }
 *                 firstName: { type: string, nullable: true }
 *                 lastName: { type: string, nullable: true }
 *       404: { description: Usuario no encontrado o fuera del scope del coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.patch('/users/:id/name', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName } = req.body;
    const result = await adminService.updateUserName(req.params.id, req.user!, firstName, lastName);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// IMPORTANT: la ruta `/users/bulk/examen-final` DEBE declararse antes que
// `/users/:id/examen-final` — Express matchea en orden de declaración y si
// `:id` va primero, captura "bulk" como UUID inválido y devuelve 404.
const bulkExamenFinalSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  enabled: z.boolean(),
});

/**
 * @openapi
 * /api/admin/users/bulk/examen-final:
 *   patch:
 *     tags: [Admin]
 *     summary: Habilita o deshabilita el examen final para varios estudiantes a la vez
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               enabled: { type: boolean }
 *     responses:
 *       200: { description: Estado actualizado para N usuarios }
 */
adminRouter.patch('/users/bulk/examen-final', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = bulkExamenFinalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('userIds (array de UUIDs, 1-500) y enabled (boolean) requeridos');
    }
    const result = await adminService.bulkToggleExamenFinal(parsed.data.userIds, parsed.data.enabled, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/users/{id}/examen-final:
 *   patch:
 *     tags: [Admin]
 *     summary: Habilita o deshabilita el examen final para un estudiante
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200: { description: Estado actualizado }
 */
adminRouter.patch('/users/:id/examen-final', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body;
    const result = await adminService.toggleExamenFinal(req.params.id, !!enabled, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Sedes CRUD (admin global only)
// ============================================
const createSedeSchema = z.object({
  slug: z.string().min(2).max(64),
  name: z.string().min(1).max(120),
  country: z.string().max(8).optional(),
  city: z.string().max(120).optional(),
  address: z.string().max(255).optional(),
});

const updateSedeSchema = z.object({
  slug: z.string().min(2).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
  country: z.string().max(8).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @openapi
 * /api/admin/sedes:
 *   get:
 *     tags: [Sedes]
 *     summary: Lista las sedes
 *     description: >-
 *       Disponible para coach y admin (necesitan elegir sede al crear usuarios).
 *       Sólo un admin global puede incluir sedes inactivas pasando
 *       `?includeInactive=true`.
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Incluir sedes inactivas (sólo admin global)
 *     responses:
 *       200:
 *         description: Lista de sedes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   slug: { type: string }
 *                   name: { type: string }
 *                   country: { type: string, nullable: true }
 *                   city: { type: string, nullable: true }
 *                   address: { type: string, nullable: true }
 *                   isActive: { type: boolean }
 */
adminRouter.get('/sedes', async (req: AuthRequest, res: Response) => {
  try {
    // Listar sedes está disponible para coach y admin (necesitan elegir sede
    // al crear users). Sólo se incluyen inactivas si lo pide admin global.
    const includeInactive = req.query.includeInactive === 'true' && req.user!.roles.includes('admin');
    const sedes = await sedesService.listSedes({ includeInactive });
    res.json(sedes);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/sedes/{id}:
 *   get:
 *     tags: [Sedes]
 *     summary: Obtiene una sede por ID (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sede
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 slug: { type: string }
 *                 name: { type: string }
 *                 country: { type: string, nullable: true }
 *                 city: { type: string, nullable: true }
 *                 address: { type: string, nullable: true }
 *                 isActive: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Sede no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/sedes/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const sede = await sedesService.getSedeById(req.params.id);
    res.json(sede);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/sedes:
 *   post:
 *     tags: [Sedes]
 *     summary: Crea una sede (sólo admin global)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, name]
 *             properties:
 *               slug: { type: string, minLength: 2, maxLength: 64, description: 'lowercase, alfanumérico y guiones' }
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               country: { type: string, maxLength: 8 }
 *               city: { type: string, maxLength: 120 }
 *               address: { type: string, maxLength: 255 }
 *     responses:
 *       201:
 *         description: Sede creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 slug: { type: string }
 *                 name: { type: string }
 *                 country: { type: string, nullable: true }
 *                 city: { type: string, nullable: true }
 *                 address: { type: string, nullable: true }
 *                 isActive: { type: boolean }
 *       400: { description: Datos de sede inválidos (slug/nombre), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Ya existe una sede con ese slug o nombre, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/sedes', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createSedeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Datos de sede inválidos');
    }
    const sede = await sedesService.createSede(parsed.data);
    res.status(201).json(sede);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/sedes/{id}:
 *   patch:
 *     tags: [Sedes]
 *     summary: Actualiza una sede (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slug: { type: string, minLength: 2, maxLength: 64 }
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               country: { type: string, maxLength: 8, nullable: true }
 *               city: { type: string, maxLength: 120, nullable: true }
 *               address: { type: string, maxLength: 255, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Sede actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 slug: { type: string }
 *                 name: { type: string }
 *                 isActive: { type: boolean }
 *       400: { description: Datos de sede inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Sede no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Slug o nombre ya en uso, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.patch('/sedes/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateSedeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Datos de sede inválidos');
    }
    const sede = await sedesService.updateSede(req.params.id, parsed.data);
    res.json(sede);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/sedes/{id}:
 *   delete:
 *     tags: [Sedes]
 *     summary: Elimina una sede (sólo admin global)
 *     description: >-
 *       Falla con 409 si la sede tiene usuarios asignados; reasignalos o
 *       desactivá la sede antes de borrar.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sede eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: La sede tiene usuarios asignados, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/sedes/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await sedesService.deleteSede(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Coaches: listado + toggles de permisos
// ============================================
// - GET /coaches: admin global (todos) o coach con canCreateCoaches (su sede)
// - PATCH /coaches/:id/permissions: admin global only
const coachPermissionsSchema = z.object({
  canCreateCoaches: z.boolean().optional(),
  canEditPrompts: z.boolean().optional(),
});

/**
 * @openapi
 * /api/admin/coaches:
 *   get:
 *     tags: [Admin]
 *     summary: Lista coaches con sus permisos
 *     description: >-
 *       Admin global ve los coaches de todas las sedes; un coach con
 *       `canCreateCoaches` ve sólo los de su propia sede. Cualquier otro caller
 *       recibe 403.
 *     responses:
 *       200:
 *         description: Lista de coaches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   email: { type: string, format: email }
 *                   firstName: { type: string, nullable: true }
 *                   lastName: { type: string, nullable: true }
 *                   sede:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       slug: { type: string }
 *                       name: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *                   permissions:
 *                     type: object
 *                     properties:
 *                       canCreateCoaches: { type: boolean }
 *                       canEditPrompts: { type: boolean }
 *                       grantedBy: { type: string, format: uuid, nullable: true }
 *                       updatedAt: { type: string, format: date-time, nullable: true }
 *       403: { description: Sin permiso para listar coaches, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/coaches', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.roles.includes('admin');
    const isCoachWithCreate =
      req.user!.roles.includes('coach') && !!req.user!.coachPermissions?.canCreateCoaches;
    if (!isAdmin && !isCoachWithCreate) {
      throw new ForbiddenError('No tenés permiso para listar coaches');
    }
    const coaches = await coachesService.listCoaches(req.user!);
    res.json(coaches);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/coaches/{id}/permissions:
 *   patch:
 *     tags: [Admin]
 *     summary: Otorga o revoca permisos de un coach (sólo admin global)
 *     description: >-
 *       Sólo admin global puede mover los toggles. El usuario target debe tener
 *       rol coach.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               canCreateCoaches: { type: boolean }
 *               canEditPrompts: { type: boolean }
 *     responses:
 *       200:
 *         description: Permisos actualizados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId: { type: string, format: uuid }
 *                 canCreateCoaches: { type: boolean }
 *                 canEditPrompts: { type: boolean }
 *                 grantedBy: { type: string, format: uuid, nullable: true }
 *                 updatedAt: { type: string, format: date-time }
 *       400: { description: Datos inválidos o el usuario target no es coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.patch('/coaches/:id/permissions', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = coachPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Datos de permisos inválidos');
    }
    const result = await coachesService.updateCoachPermissions(req.params.id, parsed.data, req.user!);
    res.json(result);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/grades - Upsert grade
// ============================================
/**
 * @openapi
 * /api/admin/grades:
 *   post:
 *     tags: [Admin]
 *     summary: Crea o actualiza la calificación final de un estudiante
 *     description: >-
 *       Admin global sobre cualquier estudiante; coach sólo sobre estudiantes
 *       de su misma sede (si no, 404). La nota debe estar entre 0 y 100.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, finalGrade]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               finalGrade: { type: number, minimum: 0, maximum: 100 }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Calificación guardada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 grade:
 *                   type: object
 *                   properties:
 *                     userId: { type: string, format: uuid }
 *                     finalGrade: { type: number }
 *                     gradedBy: { type: string, format: uuid }
 *                     notes: { type: string, nullable: true }
 *       400: { description: Calificación fuera del rango 0-100, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado o fuera del scope del coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/grades', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, finalGrade, notes } = req.body;
    const grade = await adminService.upsertGrade(userId, req.user!.id, finalGrade, req.user!, notes);
    res.json({ success: true, grade });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Agent Config CRUD
// ============================================
/**
 * @openapi
 * /api/admin/agent-configs:
 *   get:
 *     tags: [Admin]
 *     summary: Lista las configuraciones de agentes ElevenLabs (sólo admin global)
 *     responses:
 *       200:
 *         description: Lista de configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   secretName: { type: string }
 *                   agentId: { type: string }
 *                   label: { type: string, nullable: true }
 *                   isActive: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/agent-configs', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await agentConfigService.getAll();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/agent-configs:
 *   put:
 *     tags: [Admin]
 *     summary: Crea o actualiza una configuración de agente por secretName (sólo admin global)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [secretName, agentId]
 *             properties:
 *               secretName: { type: string }
 *               agentId: { type: string }
 *               label: { type: string }
 *     responses:
 *       200:
 *         description: Config guardada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 config:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     secretName: { type: string }
 *                     agentId: { type: string }
 *                     label: { type: string, nullable: true }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/agent-configs', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { secretName, agentId, label } = req.body;
    const config = await agentConfigService.upsert(secretName, agentId, label);
    res.json({ success: true, config });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/agent-configs/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Elimina una configuración de agente (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Config eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Agent config no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/agent-configs/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await agentConfigService.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Prospecting Scenarios: Prompts + Visibility
// ============================================
/**
 * @openapi
 * /api/admin/prospecting-scenarios:
 *   get:
 *     tags: [Admin]
 *     summary: Lista las configs de escenarios de prospección (prompts + visibilidad)
 *     responses:
 *       200:
 *         description: Lista de configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   secretName: { type: string }
 *                   label: { type: string, nullable: true }
 *                   systemPrompt: { type: string, nullable: true }
 *                   firstMessage: { type: string, nullable: true }
 *                   isActiveGlobal: { type: boolean }
 *                   builderParams: { type: object, nullable: true }
 */
adminRouter.get('/prospecting-scenarios', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prospectingScenariosService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/prospecting-scenarios:
 *   put:
 *     tags: [Admin]
 *     summary: Crea o actualiza la config de un escenario de prospección
 *     description: >-
 *       Requiere admin global o coach con `canEditPrompts`; cualquier otro
 *       caller recibe 403. `secretName` es obligatorio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [secretName]
 *             properties:
 *               secretName: { type: string }
 *               label: { type: string }
 *               systemPrompt: { type: string }
 *               firstMessage: { type: string }
 *               isActiveGlobal: { type: boolean }
 *               builderParams: { type: object }
 *     responses:
 *       200:
 *         description: Config guardada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 config:
 *                   type: object
 *                   properties:
 *                     secretName: { type: string }
 *                     label: { type: string, nullable: true }
 *                     systemPrompt: { type: string, nullable: true }
 *                     firstMessage: { type: string, nullable: true }
 *                     isActiveGlobal: { type: boolean }
 *       400: { description: secretName requerido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Sin permiso para editar prompts, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/prospecting-scenarios', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Editar prompts requiere admin global O coach con canEditPrompts.
    // El check va acá en vez de un middleware porque el route también
    // lo usaría un coach con permiso, así que requireGlobalAdmin no sirve.
    if (!canEditPrompts(req.user)) {
      throw new ForbiddenError('No tenés permiso para editar prompts');
    }
    const { secretName, label, systemPrompt, firstMessage, isActiveGlobal, builderParams } = req.body;
    if (!secretName) {
      res.status(400).json({ error: 'secretName required' });
      return;
    }
    const config = await prospectingScenariosService.upsertConfig(secretName, {
      label,
      systemPrompt,
      firstMessage,
      isActiveGlobal,
      builderParams,
    });
    res.json({ success: true, config });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/user-scenario-access/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los overrides de acceso a escenarios de un usuario (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Overrides por escenario
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId: { type: string, format: uuid }
 *                   secretName: { type: string }
 *                   enabled: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/user-scenario-access/:userId', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const access = await prospectingScenariosService.getUserAccess(req.params.userId);
    res.json(access);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/user-scenario-access/{userId}:
 *   put:
 *     tags: [Admin]
 *     summary: Setea en lote los overrides de acceso a escenarios de un usuario (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entries]
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [secretName, enabled]
 *                   properties:
 *                     secretName: { type: string }
 *                     enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Overrides aplicados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400: { description: entries debe ser un array, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/user-scenario-access/:userId', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body as { entries: Array<{ secretName: string; enabled: boolean }> };
    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'entries array required' });
      return;
    }
    await prospectingScenariosService.bulkSetUserAccess(req.params.userId, entries);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// AI Access Kill-Switch (global)
// ============================================
/**
 * @openapi
 * /api/admin/ai-access:
 *   get:
 *     tags: [Admin]
 *     summary: Estado del kill-switch de acceso a la IA (sólo admin global)
 *     description: >-
 *       Kill-switch en memoria que bloquea los tokens de conversación de
 *       ElevenLabs para todos los usuarios excepto admins. Se resetea a
 *       desbloqueado al reiniciar el servidor.
 *     responses:
 *       200:
 *         description: Estado actual
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locked: { type: boolean }
 *                 reason: { type: string, nullable: true }
 *                 lockedAt: { type: integer, nullable: true, description: epoch ms }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/ai-access', requireGlobalAdmin, (_req: AuthRequest, res: Response) => {
  res.json(aiAccessService.getLockStatus());
});

/**
 * @openapi
 * /api/admin/ai-access:
 *   put:
 *     tags: [Admin]
 *     summary: Activa o desactiva el kill-switch de acceso a la IA (sólo admin global)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locked: { type: boolean }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Nuevo estado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 locked: { type: boolean }
 *                 reason: { type: string, nullable: true }
 *                 lockedAt: { type: integer, nullable: true }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/ai-access', requireGlobalAdmin, (req: AuthRequest, res: Response) => {
  const { locked, reason } = req.body as { locked?: boolean; reason?: string };
  aiAccessService.setAiLocked(!!locked, reason ?? null);
  res.json({ success: true, ...aiAccessService.getLockStatus() });
});

// ============================================
// Admin Analytics
// ============================================
/**
 * @openapi
 * /api/admin/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Analíticas agregadas del grupo
 *     description: >-
 *       Métricas agregadas sede-aware. Admin global ve todas las sedes; un
 *       coach/instructor ve sólo su propia sede.
 *     responses:
 *       200: { description: Analíticas del grupo }
 */
adminRouter.get('/analytics', analyticsController.getAdminAnalytics);

// ============================================
// A/B Testing Experiments (admin global only)
// ============================================
/**
 * @openapi
 * /api/admin/experiments:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los experimentos A/B (sólo admin global)
 *     responses:
 *       200:
 *         description: Lista de experimentos con sus variantes y conteo de asignaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   description: { type: string, nullable: true }
 *                   status: { type: string, enum: [draft, active, completed] }
 *                   agentSecretName: { type: string }
 *                   variants: { type: array, items: { type: object } }
 *                   _count:
 *                     type: object
 *                     properties:
 *                       assignments: { type: integer }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/experiments', requireGlobalAdmin, abTestingController.list);
/**
 * @openapi
 * /api/admin/experiments:
 *   post:
 *     tags: [Admin]
 *     summary: Crea un experimento A/B (sólo admin global)
 *     description: Requiere al menos 2 variantes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, agentSecretName, variants]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               agentSecretName: { type: string }
 *               variants:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     name: { type: string }
 *                     systemPrompt: { type: string }
 *                     firstMessage: { type: string }
 *                     weight: { type: integer, default: 1 }
 *     responses:
 *       201:
 *         description: Experimento creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 variants: { type: array, items: { type: object } }
 *       400: { description: Se requieren al menos 2 variantes, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/experiments', requireGlobalAdmin, abTestingController.create);
/**
 * @openapi
 * /api/admin/experiments/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Obtiene un experimento A/B por ID con sus asignaciones (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Experimento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 variants: { type: array, items: { type: object } }
 *                 assignments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string, format: uuid }
 *                       variantId: { type: string, format: uuid }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Experimento no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/experiments/:id', requireGlobalAdmin, abTestingController.getById);
/**
 * @openapi
 * /api/admin/experiments/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Actualiza un experimento A/B (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [draft, active, completed] }
 *     responses:
 *       200:
 *         description: Experimento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 status: { type: string }
 *                 variants: { type: array, items: { type: object } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Experimento no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/experiments/:id', requireGlobalAdmin, abTestingController.update);
/**
 * @openapi
 * /api/admin/experiments/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Elimina un experimento A/B (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Experimento eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/experiments/:id', requireGlobalAdmin, abTestingController.remove);
/**
 * @openapi
 * /api/admin/experiments/{id}/results:
 *   get:
 *     tags: [Admin]
 *     summary: Resultados agregados de un experimento A/B por variante (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultados por variante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 experiment:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string }
 *                     status: { type: string }
 *                     agentSecretName: { type: string }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variantId: { type: string, format: uuid }
 *                       variantName: { type: string }
 *                       assignmentCount: { type: integer }
 *                       sessionCount: { type: integer }
 *                       avgScore: { type: number, nullable: true }
 *                       avgDuration: { type: integer, nullable: true }
 *                       passRate: { type: integer }
 *                       breakdownAvg: { type: object }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Experimento no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/experiments/:id/results', requireGlobalAdmin, abTestingController.getResults);

// ============================================
// Admin Session Transcript (view any student's session)
// ============================================
/**
 * @openapi
 * /api/admin/sessions/{id}/transcript:
 *   get:
 *     tags: [Admin]
 *     summary: Obtiene la transcripción y evaluación de una sesión de cualquier estudiante
 *     description: >-
 *       Admin global puede ver cualquier sesión; un coach sólo las de
 *       estudiantes de su misma sede (si no, 404 para no filtrar existencia
 *       entre sedes).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transcripción + evaluación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transcript: { type: array, items: { type: object }, nullable: true }
 *                 score: { type: integer, nullable: true }
 *                 passed: { type: boolean }
 *                 aiFeedback: { type: string, nullable: true }
 *                 durationSeconds: { type: integer }
 *                 createdAt: { type: string, format: date-time }
 *                 scenarioName: { type: string, nullable: true }
 *                 breakdown: { type: object, nullable: true }
 *                 summary: { type: object, nullable: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     firstName: { type: string, nullable: true }
 *                     lastName: { type: string, nullable: true }
 *                     email: { type: string, format: email }
 *       404: { description: Sesión no encontrada o fuera del scope del coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/sessions/:id/transcript', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await sessionsService.getTranscriptAdmin(req.params.id, req.user!);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/agent-latency:
 *   get:
 *     tags: [Admin]
 *     summary: Métricas agregadas de latencia (TTFA y connect) sobre sesiones reales
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 50 }
 *     responses:
 *       200:
 *         description: Agregados + sesiones recientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ttfa: { $ref: '#/components/schemas/AgentLatencyAggregate' }
 *                 connect: { $ref: '#/components/schemas/AgentLatencyAggregate' }
 *                 sessionCount: { type: integer }
 *                 recent:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       createdAt: { type: string, format: date-time }
 *                       durationSeconds: { type: integer }
 *                       connectMs: { type: integer, nullable: true }
 *                       ttfaSamplesCount: { type: integer }
 *                       ttfaAvgMs: { type: integer, nullable: true }
 *                       ttfaP95Ms: { type: integer, nullable: true }
 *                       userName: { type: string }
 *                       scenarioName: { type: string, nullable: true }
 */
// ============================================
// Agent Latency (real-session metrics)
// ============================================
// Aggregated TTFA + connect latency across all PracticeSessions.
// Used by the admin "Performance del Agente" tab.
// ============================================
adminRouter.get('/agent-latency', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const sessions = await prisma.practiceSession.findMany({
      where: {
        OR: [
          { connectMs: { not: null } },
          { ttfaSamplesMs: { isEmpty: false } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        scenario: { select: { name: true } },
      },
    });

    const allTtfa: number[] = [];
    const allConnect: number[] = [];
    const recent = sessions.map((s) => {
      const samples = s.ttfaSamplesMs ?? [];
      allTtfa.push(...samples);
      if (s.connectMs !== null && s.connectMs !== undefined) allConnect.push(s.connectMs);
      const sorted = [...samples].sort((a, b) => a - b);
      const avg = samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null;
      const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null;
      return {
        id: s.id,
        createdAt: s.createdAt,
        durationSeconds: s.durationSeconds,
        connectMs: s.connectMs,
        ttfaSamplesCount: samples.length,
        ttfaAvgMs: avg,
        ttfaP95Ms: p95,
        userName: `${s.user.firstName ?? ''} ${s.user.lastName ?? ''}`.trim() || s.user.email,
        scenarioName: s.scenario?.name ?? null,
      };
    });

    const aggregate = (values: number[]) => {
      if (values.length === 0) return { avg: null, p50: null, p95: null, count: 0 };
      const sorted = [...values].sort((a, b) => a - b);
      const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      return { avg, p50, p95, count: sorted.length };
    };

    res.json({
      ttfa: aggregate(allTtfa),
      connect: aggregate(allConnect),
      sessionCount: sessions.length,
      recent,
    });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Latency Probe (admin diagnostics)
// ============================================
// Un run "tipo Speedtest" se arma con:
//   - GET /latency-probe          → probes server-side (DB, ElevenLabs voz)
//   - GET /latency-probe/ping     → round-trip puro navegador↔servidor
//   - GET /latency-probe/download → descarga N bytes para medir ancho de banda de bajada
//   - POST /latency-probe/upload  → recibe bytes crudos para medir subida
// ============================================

/**
 * @openapi
 * /api/admin/latency-probe:
 *   get:
 *     tags: [Admin]
 *     summary: Corre probes server-side de latencia (DB + ElevenLabs) (sólo admin global)
 *     responses:
 *       200:
 *         description: Reporte de probes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp: { type: string, format: date-time }
 *                 totalMs: { type: integer }
 *                 probes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service: { type: string, enum: [database, elevenlabs] }
 *                       ok: { type: boolean }
 *                       latencyMs: { type: integer }
 *                       status: { type: integer }
 *                       error: { type: string }
 *                       skipped: { type: boolean }
 *                       target: { type: string }
 *                       detail: { type: string }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/latency-probe', requireGlobalAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const report = await latencyProbeService.runAllProbes();
    res.json(report);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/latency-probe/ping:
 *   get:
 *     tags: [Admin]
 *     summary: Ping ligero para medir RTT navegador↔servidor (sólo admin global)
 *     description: El cliente mide el round-trip; el servidor solo responde con su timestamp.
 *     responses:
 *       200:
 *         description: Timestamp del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 t: { type: integer, description: epoch ms del servidor }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
// Ping ligero: el cliente mide el RTT, el servidor solo responde con su timestamp.
adminRouter.get('/latency-probe/ping', requireGlobalAdmin, (_req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ t: Date.now() });
});

// Descarga un payload de tamano conocido. Sirve para estimar el ancho de banda de bajada.
// Se capa a 5MB para evitar abusos.
const DOWNLOAD_MAX_BYTES = 5 * 1024 * 1024;
/**
 * @openapi
 * /api/admin/latency-probe/download:
 *   get:
 *     tags: [Admin]
 *     summary: Descarga un payload de tamaño conocido para medir ancho de banda de bajada (sólo admin global)
 *     description: Devuelve un buffer de ceros. Capado a 5 MB. Default 1 MB si no se pasa `bytes`.
 *     parameters:
 *       - in: query
 *         name: bytes
 *         schema: { type: integer, minimum: 1, maximum: 5242880, default: 1048576 }
 *     responses:
 *       200:
 *         description: Payload binario
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/latency-probe/download', requireGlobalAdmin, (req: AuthRequest, res: Response) => {
  const requested = parseInt(String(req.query.bytes ?? ''), 10);
  const bytes = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, DOWNLOAD_MAX_BYTES)
    : 1024 * 1024;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', String(bytes));
  // Buffer lleno de ceros — no nos importa el contenido, solo el tamano.
  res.end(Buffer.alloc(bytes));
});

/**
 * @openapi
 * /api/admin/latency-probe/upload:
 *   post:
 *     tags: [Admin]
 *     summary: Recibe un payload crudo para medir ancho de banda de subida (sólo admin global)
 *     description: El cliente mide cuánto tardó el POST. Límite 10 MB. Acepta cualquier content-type binario.
 *     requestBody:
 *       required: true
 *       content:
 *         application/octet-stream:
 *           schema: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Cantidad de bytes recibidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received: { type: integer }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
// Recibe un payload crudo y responde con el conteo. El cliente mide cuanto tardo el POST.
adminRouter.post(
  '/latency-probe/upload',
  requireGlobalAdmin,
  raw({ type: '*/*', limit: '10mb' }),
  (req: AuthRequest, res: Response) => {
    const body = req.body as Buffer | undefined;
    const received = body && Buffer.isBuffer(body) ? body.length : 0;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ received });
  }
);

// ============================================
// LTI Platform CRUD
// ============================================
/**
 * @openapi
 * /api/admin/lti-platforms:
 *   get:
 *     tags: [Admin]
 *     summary: Lista las plataformas LTI registradas (sólo admin global)
 *     responses:
 *       200:
 *         description: Lista de plataformas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   issuerUrl: { type: string }
 *                   clientId: { type: string }
 *                   authEndpoint: { type: string }
 *                   tokenEndpoint: { type: string }
 *                   jwksUrl: { type: string }
 *                   deploymentId: { type: string, nullable: true }
 *                   isActive: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/lti-platforms', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platforms = await prisma.ltiPlatform.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(platforms);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti-platforms:
 *   post:
 *     tags: [Admin]
 *     summary: Registra una plataforma LTI (sólo admin global)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl]
 *             properties:
 *               name: { type: string }
 *               issuerUrl: { type: string }
 *               clientId: { type: string }
 *               authEndpoint: { type: string }
 *               tokenEndpoint: { type: string }
 *               jwksUrl: { type: string }
 *               deploymentId: { type: string }
 *     responses:
 *       201:
 *         description: Plataforma creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 platform: { type: object }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/lti-platforms', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId } = req.body;
    const platform = await prisma.ltiPlatform.create({
      data: { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId },
    });
    res.status(201).json({ success: true, platform });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti-platforms/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Actualiza una plataforma LTI (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               issuerUrl: { type: string }
 *               clientId: { type: string }
 *               authEndpoint: { type: string }
 *               tokenEndpoint: { type: string }
 *               jwksUrl: { type: string }
 *               deploymentId: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Plataforma actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 platform: { type: object }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Plataforma no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.put('/lti-platforms/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId, isActive } = req.body;
    const platform = await prisma.ltiPlatform.update({
      where: { id: req.params.id },
      data: { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId, isActive },
    });
    res.json({ success: true, platform });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti-platforms/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Elimina una plataforma LTI (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Plataforma eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Plataforma no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/lti-platforms/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.ltiPlatform.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Manually retry pushing a session's score to the platform's gradebook.
// Useful when the fire-and-forget hook in saveEvaluation failed (Moodle
// down, lineitem mis-configured, etc.) and the operator wants to reconcile
// without re-running the practice.
/**
 * @openapi
 * /api/admin/lti/sessions/{practiceSessionId}/resync-grade:
 *   post:
 *     tags: [Admin]
 *     summary: Reintenta empujar la nota de una sesión al gradebook de la plataforma LTI (sólo admin global)
 *     description: >-
 *       Útil cuando el hook fire-and-forget de saveEvaluation falló (Moodle
 *       caído, lineitem mal configurado, etc.). Empuja siempre como FullyGraded.
 *     parameters:
 *       - in: path
 *         name: practiceSessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado del reintento de envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 outcome: { type: object }
 *       400: { description: La sesión todavía no tiene score, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Sesión de práctica no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post(
  '/lti/sessions/:practiceSessionId/resync-grade',
  requireGlobalAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const session = await prisma.practiceSession.findUnique({
        where: { id: req.params.practiceSessionId },
        select: { id: true, userId: true, score: true, passed: true, aiFeedback: true },
      });
      if (!session) {
        res.status(404).json({ error: 'Practice session not found' });
        return;
      }
      if (session.score === null) {
        res.status(400).json({ error: 'Session has no score yet — cannot resync' });
        return;
      }

      // Manual resync always pushes as FullyGraded — the score is already
      // persisted, so from the gradebook's perspective grading is done.
      const outcome = await submitScoreForUser({
        userId: session.userId,
        score: session.score,
        scoreMaximum: 100,
        feedback: session.aiFeedback ?? undefined,
        gradingProgress: 'FullyGraded',
      });

      res.json({ outcome });
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({ error: appError.message });
    }
  },
);

// ============================================
// LTI Course Sync (NRPS) — pre-create LtiSessions so users who practice
// from the web link still get grades posted to Moodle.
// ============================================

/**
 * @openapi
 * /api/admin/lti/courses:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los cursos LTI sincronizados vía NRPS (sólo admin global)
 *     responses:
 *       200:
 *         description: Lista de cursos sincronizados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   platformId: { type: string, format: uuid }
 *                   contextId: { type: string }
 *                   contextTitle: { type: string, nullable: true }
 *                   membershipsUrl: { type: string }
 *                   lineitemUrl: { type: string, nullable: true }
 *                   isActive: { type: boolean }
 *                   platform:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       issuerUrl: { type: string }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/lti/courses', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.ltiCourseSync.findMany({
      orderBy: { createdAt: 'desc' },
      include: { platform: { select: { name: true, issuerUrl: true } } },
    });
    res.json(courses);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Manual course registration — useful when no launch has happened yet
// (which would auto-detect), or when the admin wants to override the
// lineitem captured from a launch.
/**
 * @openapi
 * /api/admin/lti/courses:
 *   post:
 *     tags: [Admin]
 *     summary: Registra (upsert) un curso LTI para sincronización NRPS (sólo admin global)
 *     description: >-
 *       Útil cuando aún no hubo un launch (auto-detección) o el admin quiere
 *       sobrescribir el lineitem capturado. Upsert por (platformId, contextId).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platformId, contextId, membershipsUrl]
 *             properties:
 *               platformId: { type: string, format: uuid }
 *               contextId: { type: string }
 *               contextTitle: { type: string }
 *               membershipsUrl: { type: string, format: uri }
 *               lineitemUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Curso registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 course: { type: object }
 *       400: { description: Datos inválidos (URLs o IDs), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/lti/courses', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      platformId: z.string().uuid(),
      contextId: z.string().min(1),
      contextTitle: z.string().optional(),
      membershipsUrl: z.string().url(),
      lineitemUrl: z.string().url().optional(),
    });
    const data = schema.parse(req.body);

    const course = await prisma.ltiCourseSync.upsert({
      where: {
        platformId_contextId: { platformId: data.platformId, contextId: data.contextId },
      },
      create: {
        platformId: data.platformId,
        contextId: data.contextId,
        contextTitle: data.contextTitle ?? null,
        membershipsUrl: data.membershipsUrl,
        lineitemUrl: data.lineitemUrl ?? null,
      },
      update: {
        contextTitle: data.contextTitle ?? undefined,
        membershipsUrl: data.membershipsUrl,
        lineitemUrl: data.lineitemUrl ?? null,
      },
    });
    res.status(201).json({ success: true, course });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti/courses/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualiza un curso LTI sincronizado (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contextTitle: { type: string, nullable: true }
 *               membershipsUrl: { type: string, format: uri }
 *               lineitemUrl: { type: string, format: uri, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Curso actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 course: { type: object }
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Curso no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.patch('/lti/courses/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      contextTitle: z.string().nullable().optional(),
      membershipsUrl: z.string().url().optional(),
      lineitemUrl: z.string().url().nullable().optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const course = await prisma.ltiCourseSync.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, course });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti/courses/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Elimina un curso LTI sincronizado (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Curso eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Curso no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.delete('/lti/courses/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.ltiCourseSync.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// On-demand sync trigger. Returns the SyncCourseResult counters so the
// admin sees how many were matched/created/pending.
/**
 * @openapi
 * /api/admin/lti/courses/{id}/sync:
 *   post:
 *     tags: [Admin]
 *     summary: Dispara una sincronización NRPS on-demand de un curso (sólo admin global)
 *     description: Devuelve los contadores del resultado (matched/created/pending/etc.).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado de la sincronización
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 result:
 *                   type: object
 *                   properties:
 *                     courseSyncId: { type: string, format: uuid }
 *                     membersFetched: { type: integer }
 *                     matched: { type: integer }
 *                     created: { type: integer }
 *                     pending: { type: integer }
 *                     skipped: { type: integer }
 *                     errors: { type: integer }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Curso no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: El curso está inactivo o falló la sincronización, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/lti/courses/:id/sync', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await syncCourse(req.params.id);
    res.json({ success: true, result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Run one full NRPS sync tick across every active LtiCourseSync. Same code
// path as the cron, exposed manually so the admin can force-sync everything
// without waiting for the next scheduled firing.
/**
 * @openapi
 * /api/admin/lti/sync-all:
 *   post:
 *     tags: [Admin]
 *     summary: Corre un tick completo de sincronización NRPS sobre todos los cursos activos (sólo admin global)
 *     description: Mismo code path que el cron, expuesto manualmente para forzar sin esperar el próximo disparo programado.
 *     responses:
 *       200:
 *         description: Resultado del tick
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 result:
 *                   type: object
 *                   properties:
 *                     startedAt: { type: string, format: date-time }
 *                     finishedAt: { type: string, format: date-time }
 *                     coursesProcessed: { type: integer }
 *                     coursesSucceeded: { type: integer }
 *                     coursesFailed: { type: integer }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post('/lti/sync-all', requireGlobalAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await runNrpsSyncTick();
    res.json({ success: true, result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Pending matches — only the still-open ones, with candidate users
// embedded so the admin UI can render the picker without N+1 queries.
/**
 * @openapi
 * /api/admin/lti/pending-matches:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los matches NRPS pendientes (ambiguos) sin resolver (sólo admin global)
 *     description: >-
 *       Sólo los matches aún abiertos (no resueltos ni descartados), con los
 *       usuarios candidatos embebidos para que la UI renderice el picker sin
 *       N+1.
 *     responses:
 *       200:
 *         description: Lista de matches pendientes con candidatos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   candidateUserIds: { type: array, items: { type: string, format: uuid } }
 *                   courseSync:
 *                     type: object
 *                     properties:
 *                       contextTitle: { type: string, nullable: true }
 *                       contextId: { type: string }
 *                   candidates:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         email: { type: string, format: email }
 *                         firstName: { type: string, nullable: true }
 *                         lastName: { type: string, nullable: true }
 *                         createdAt: { type: string, format: date-time }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.get('/lti/pending-matches', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pending = await prisma.ltiPendingMatch.findMany({
      where: { resolvedAt: null, dismissedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { courseSync: { select: { contextTitle: true, contextId: true } } },
    });

    const candidateIds = Array.from(new Set(pending.flatMap((p) => p.candidateUserIds)));
    const candidates = candidateIds.length
      ? await prisma.user.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
        })
      : [];
    const candidateById = new Map(candidates.map((c) => [c.id, c]));

    res.json(
      pending.map((p) => ({
        ...p,
        candidates: p.candidateUserIds.map((id) => candidateById.get(id)).filter(Boolean),
      })),
    );
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/admin/lti/pending-matches/{id}/resolve:
 *   post:
 *     tags: [Admin]
 *     summary: Resuelve un match NRPS pendiente vinculándolo a un usuario (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Match resuelto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400: { description: userId inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Match pendiente no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post(
  '/lti/pending-matches/:id/resolve',
  requireGlobalAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({ userId: z.string().uuid() });
      const { userId } = schema.parse(req.body);
      await resolvePendingMatch(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({ error: appError.message });
    }
  },
);

/**
 * @openapi
 * /api/admin/lti/pending-matches/{id}/dismiss:
 *   post:
 *     tags: [Admin]
 *     summary: Descarta un match NRPS pendiente sin vincularlo (sólo admin global)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Match descartado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       403: { description: No es admin global, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Match pendiente no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
adminRouter.post(
  '/lti/pending-matches/:id/dismiss',
  requireGlobalAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      await dismissPendingMatch(req.params.id);
      res.json({ success: true });
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({ error: appError.message });
    }
  },
);
