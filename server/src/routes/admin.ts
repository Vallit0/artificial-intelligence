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
const bulkExamenFinalSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  enabled: z.boolean(),
});

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

adminRouter.get('/sedes/:id', requireGlobalAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const sede = await sedesService.getSedeById(req.params.id);
    res.json(sede);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

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
adminRouter.get('/agent-configs', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await agentConfigService.getAll();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

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
adminRouter.get('/prospecting-scenarios', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prospectingScenariosService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

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

adminRouter.get('/user-scenario-access/:userId', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const access = await prospectingScenariosService.getUserAccess(req.params.userId);
    res.json(access);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

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
adminRouter.get('/ai-access', requireGlobalAdmin, (_req: AuthRequest, res: Response) => {
  res.json(aiAccessService.getLockStatus());
});

adminRouter.put('/ai-access', requireGlobalAdmin, (req: AuthRequest, res: Response) => {
  const { locked, reason } = req.body as { locked?: boolean; reason?: string };
  aiAccessService.setAiLocked(!!locked, reason ?? null);
  res.json({ success: true, ...aiAccessService.getLockStatus() });
});

// ============================================
// Admin Analytics
// ============================================
adminRouter.get('/analytics', analyticsController.getAdminAnalytics);

// ============================================
// A/B Testing Experiments (admin global only)
// ============================================
adminRouter.get('/experiments', requireGlobalAdmin, abTestingController.list);
adminRouter.post('/experiments', requireGlobalAdmin, abTestingController.create);
adminRouter.get('/experiments/:id', requireGlobalAdmin, abTestingController.getById);
adminRouter.put('/experiments/:id', requireGlobalAdmin, abTestingController.update);
adminRouter.delete('/experiments/:id', requireGlobalAdmin, abTestingController.remove);
adminRouter.get('/experiments/:id/results', requireGlobalAdmin, abTestingController.getResults);

// ============================================
// Admin Session Transcript (view any student's session)
// ============================================
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

adminRouter.get('/latency-probe', requireGlobalAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const report = await latencyProbeService.runAllProbes();
    res.json(report);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Ping ligero: el cliente mide el RTT, el servidor solo responde con su timestamp.
adminRouter.get('/latency-probe/ping', requireGlobalAdmin, (_req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ t: Date.now() });
});

// Descarga un payload de tamano conocido. Sirve para estimar el ancho de banda de bajada.
// Se capa a 5MB para evitar abusos.
const DOWNLOAD_MAX_BYTES = 5 * 1024 * 1024;
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
adminRouter.get('/lti-platforms', requireGlobalAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platforms = await prisma.ltiPlatform.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(platforms);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

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
