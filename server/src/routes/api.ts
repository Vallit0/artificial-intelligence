// ============================================
// API Routes
// ============================================

import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as scenariosController from '../controllers/scenarios.controller.js';
import * as sessionsController from '../controllers/sessions.controller.js';
import * as progressController from '../controllers/progress.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as prospectingScenariosService from '../services/prospectingScenarios.service.js';
import * as appConfigService from '../services/appConfig.service.js';
import * as sedesService from '../services/sedes.service.js';
import * as coachesService from '../services/coaches.service.js';
import * as divisionsService from '../services/divisions.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

export const apiRouter = Router();

// ============================================
// Public Routes
// ============================================

/**
 * @openapi
 * /api/scenarios:
 *   get:
 *     tags: [Scenarios]
 *     summary: Lista todos los escenarios disponibles
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de escenarios
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Scenario' } }
 *
 * /api/scenarios/{id}:
 *   get:
 *     tags: [Scenarios]
 *     summary: Devuelve un escenario por id
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Escenario
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Scenario' }
 *       404: { description: No encontrado }
 */
apiRouter.get('/scenarios', scenariosController.getAll);
apiRouter.get('/scenarios/:id', scenariosController.getById);

// Lista pública de sedes activas — usada por el selector de sede en el
// signup. Devuelve sólo los campos necesarios; admin global tiene un
// endpoint separado bajo /api/admin/sedes con más detalle.
/**
 * @openapi
 * /api/sedes:
 *   get:
 *     tags: [Users]
 *     summary: Lista pública de sedes activas
 *     description: Usada por el selector de sede en el signup. Devuelve sólo id, slug, name y country.
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de sedes activas
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
 */
apiRouter.get('/sedes', async (req: AuthRequest, res: Response) => {
  try {
    const sedes = await sedesService.listSedes();
    res.json(sedes.map((s) => ({ id: s.id, slug: s.slug, name: s.name, country: s.country })));
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Lista pública de coaches de una sede — usada por el selector de coach en el
// signup (obligatorio). Devuelve sólo { id, name }. Requiere ?sedeId= (UUID o
// slug); sin él responde 400.
/**
 * @openapi
 * /api/coaches:
 *   get:
 *     tags: [Users]
 *     summary: Lista pública de coaches de una sede
 *     description: Usada por el selector de coach en el signup. Requiere sedeId (UUID o slug). Devuelve sólo id y name.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: sedeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de coaches de la sede
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *       400: { description: sedeId faltante o sede inválida }
 */
apiRouter.get('/coaches', async (req: AuthRequest, res: Response) => {
  try {
    const sedeRef = (req.query.sedeId ?? req.query.sede) as string | undefined;
    const coaches = await coachesService.listPublicCoachesBySede(sedeRef ?? '');
    res.json(coaches);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Lista pública de divisiones activas de una sede — usada por el selector de
// división en el signup. Devuelve sólo { id, name }. Requiere ?sedeId= (UUID o
// slug). El estudiante elige una división y hereda su coach.
/**
 * @openapi
 * /api/divisions:
 *   get:
 *     tags: [Users]
 *     summary: Lista pública de divisiones de una sede
 *     description: Usada por el selector de división en el signup. Requiere sedeId (UUID o slug). Devuelve sólo id y name.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: sedeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de divisiones de la sede }
 *       400: { description: sedeId faltante o sede inválida }
 */
apiRouter.get('/divisions', async (req: AuthRequest, res: Response) => {
  try {
    const sedeRef = (req.query.sedeId ?? req.query.sede) as string | undefined;
    const divisions = await divisionsService.listPublicDivisionsBySede(sedeRef ?? '');
    res.json(divisions);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Protected Routes
// ============================================

apiRouter.use(authMiddleware);

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: Lista las sesiones del usuario autenticado
 *     responses:
 *       200:
 *         description: Lista de sesiones
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/PracticeSession' } }
 *   post:
 *     tags: [Sessions]
 *     summary: Crea una sesión nueva (al iniciar una llamada)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenarioId: { type: string, nullable: true }
 *               durationSeconds: { type: integer, default: 0 }
 *               abVariantId: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Sesión creada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PracticeSession' }
 */
apiRouter.get('/sessions', sessionsController.getAll);
apiRouter.post('/sessions', sessionsController.create);

/**
 * @openapi
 * /api/sessions/{id}:
 *   patch:
 *     tags: [Sessions]
 *     summary: Actualiza una sesión (duración, score, latencia, etc.)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               durationSeconds: { type: integer }
 *               score: { type: integer }
 *               passed: { type: boolean }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               aiFeedback: { type: string }
 *               connectMs: { type: integer, nullable: true }
 *               ttfaSamplesMs: { type: array, items: { type: integer } }
 *     responses:
 *       200:
 *         description: Sesión actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PracticeSession' }
 *       404: { description: Sesión no encontrada o no pertenece al usuario }
 */
apiRouter.patch('/sessions/:id', sessionsController.update);

/**
 * @openapi
 * /api/sessions/evaluate:
 *   post:
 *     tags: [Sessions]
 *     summary: Evalúa el transcript de una sesión y persiste el puntaje
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transcript]
 *             properties:
 *               sessionId: { type: string, format: uuid }
 *               transcript:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, agent] }
 *                     content: { type: string }
 *                     timestamp: { type: integer }
 *               scenarioId: { type: string, format: uuid, nullable: true }
 *               durationSeconds: { type: integer }
 *     responses:
 *       200:
 *         description: Resultado de la evaluación
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EvaluationResult' }
 */
apiRouter.post('/sessions/evaluate', sessionsController.evaluate);

/**
 * @openapi
 * /api/sessions/{id}/transcript:
 *   post:
 *     tags: [Sessions]
 *     summary: Guarda el transcript completo de la sesión
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transcript: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: OK }
 *   get:
 *     tags: [Sessions]
 *     summary: Obtiene el transcript de la sesión
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Transcript }
 *       404: { description: Sesión no encontrada }
 */
apiRouter.post('/sessions/:id/transcript', sessionsController.saveTranscript);
apiRouter.get('/sessions/:id/transcript', sessionsController.getTranscript);

// User Progress
/**
 * @openapi
 * components:
 *   schemas:
 *     UserProgress:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         scenarioId: { type: string, format: uuid }
 *         isUnlocked: { type: boolean }
 *         isCompleted: { type: boolean }
 *         bestScore: { type: integer, nullable: true }
 *         attempts: { type: integer }
 *         firstCompletedAt: { type: string, format: date-time, nullable: true }
 *         lastAttemptAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /api/progress:
 *   get:
 *     tags: [Progress]
 *     summary: Devuelve el progreso por escenario del usuario autenticado
 *     responses:
 *       200:
 *         description: Lista de progreso por escenario (ordenada por displayOrder del escenario)
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/UserProgress' } }
 *   post:
 *     tags: [Progress]
 *     summary: Crea o actualiza (upsert) el progreso del usuario en un escenario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scenarioId]
 *             properties:
 *               scenarioId: { type: string, format: uuid }
 *               isUnlocked: { type: boolean }
 *               isCompleted: { type: boolean }
 *               bestScore: { type: integer }
 *               attempts: { type: integer }
 *     responses:
 *       200:
 *         description: Progreso actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserProgress' }
 */
apiRouter.get('/progress', progressController.getProgress);
apiRouter.post('/progress', progressController.updateProgress);

// User Stats
/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags: [Progress]
 *     summary: Devuelve estadísticas agregadas del usuario autenticado
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSessions: { type: integer }
 *                 totalTime: { type: integer, description: Suma de durationSeconds }
 *                 avgScore: { type: number }
 *                 completedScenarios: { type: integer }
 *                 practiceDays: { type: integer, description: Días con práctica en los últimos 30 días }
 */
apiRouter.get('/stats', sessionsController.getStats);

// Analytics
/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Dashboard analítico del usuario autenticado
 *     description: Historial de puntajes con breakdown, promedios de competencias, último breakdown y heatmap de actividad (últimos 90 días).
 *     responses:
 *       200:
 *         description: Datos del dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scoreHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, format: date-time }
 *                       score: { type: integer }
 *                       scenarioName: { type: string }
 *                       breakdown:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           apertura: { type: integer }
 *                           escuchaActiva: { type: integer }
 *                           manejoObjeciones: { type: integer }
 *                           propuestaValor: { type: integer }
 *                           cierre: { type: integer }
 *                 averageBreakdown:
 *                   type: object
 *                   properties:
 *                     apertura: { type: number, nullable: true }
 *                     escuchaActiva: { type: number, nullable: true }
 *                     manejoObjeciones: { type: number, nullable: true }
 *                     propuestaValor: { type: number, nullable: true }
 *                     cierre: { type: number, nullable: true }
 *                 latestBreakdown:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     apertura: { type: integer }
 *                     escuchaActiva: { type: integer }
 *                     manejoObjeciones: { type: integer }
 *                     propuestaValor: { type: integer }
 *                     cierre: { type: integer }
 *                 activityHeatmap:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, format: date }
 *                       count: { type: integer }
 *
 * /api/analytics/competencies:
 *   get:
 *     tags: [Analytics]
 *     summary: Historial de competencias por sesión (breakdown a lo largo del tiempo)
 *     responses:
 *       200:
 *         description: Serie temporal de breakdowns por sesión
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, format: date-time }
 *                   score: { type: integer, nullable: true }
 *                   apertura: { type: integer }
 *                   escuchaActiva: { type: integer }
 *                   manejoObjeciones: { type: integer }
 *                   propuestaValor: { type: integer }
 *                   cierre: { type: integer }
 */
apiRouter.get('/analytics/dashboard', analyticsController.getUserDashboard);
apiRouter.get('/analytics/competencies', analyticsController.getCompetencyHistory);

/**
 * @openapi
 * /api/users/me/unlock-level2:
 *   post:
 *     tags: [Users]
 *     summary: Desbloquea Manejo de Objeciones (Nivel 2) para el usuario actual
 *     description: Requiere que el usuario tenga al menos una sesión de examen final aprobada (sin scenarioId).
 *     responses:
 *       200:
 *         description: Nivel 2 desbloqueado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 level2Unlocked: { type: boolean }
 *       403: { description: Examen final no aprobado }
 */
apiRouter.post('/users/me/unlock-level2', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { default: prisma } = await import('../db/index.js');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { level2Unlocked: true },
      select: { level2Unlocked: true },
    });
    res.json({ success: true, level2Unlocked: updated.level2Unlocked });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/users/me/complete-course:
 *   post:
 *     tags: [Users]
 *     summary: Marca el curso (programa) como completado para el usuario actual
 *     description: Se invoca al aprobar el examen final de Nivel 2 (Manejo de Objeciones). Habilita el certificado de finalización.
 *     responses:
 *       200:
 *         description: Curso marcado como completado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 courseCompleted: { type: boolean }
 */
apiRouter.post('/users/me/complete-course', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { default: prisma } = await import('../db/index.js');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { courseCompleted: true },
      select: { courseCompleted: true },
    });
    res.json({ success: true, courseCompleted: updated.courseCompleted });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /api/users/me/complete-tutorial:
 *   post:
 *     tags: [Users]
 *     summary: Marca el tour guiado del primer login como completado
 *     description: Se invoca al terminar o saltar el onboarding tour. Mientras sea false, /practice vuelve a mostrar el tour.
 *     responses:
 *       200:
 *         description: Tutorial marcado como completado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 tutorialCompleted: { type: boolean }
 */
apiRouter.post('/users/me/complete-tutorial', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { default: prisma } = await import('../db/index.js');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tutorialCompleted: true },
      select: { tutorialCompleted: true },
    });
    res.json({ success: true, tutorialCompleted: updated.tutorialCompleted });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Configuración global de la plataforma (lectura para cualquier usuario
// autenticado): duraciones de llamada, umbrales y datos del certificado. La
// escritura es admin-only vía PUT /api/admin/config. Ningún campo es sensible.
apiRouter.get('/config', async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await appConfigService.getAppConfig());
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// Prospecting Scenarios visible to current user
/**
 * @openapi
 * /api/prospecting-scenarios/me:
 *   get:
 *     tags: [Scenarios]
 *     summary: Nombres secretos de escenarios de prospección visibles para el usuario actual
 *     description: Combina la configuración global con los overrides por usuario.
 *     responses:
 *       200:
 *         description: Lista de nombres secretos visibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 visible:
 *                   type: array
 *                   items: { type: string }
 *                 overrides:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       secretName: { type: string }
 *                       label: { type: string, nullable: true }
 *                       description: { type: string, nullable: true }
 *                       videoUrl: { type: string, nullable: true }
 */
apiRouter.get('/prospecting-scenarios/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [visible, overrides] = await Promise.all([
      prospectingScenariosService.getVisibleSecretNamesForUser(userId),
      prospectingScenariosService.getDisplayOverrides(),
    ]);
    res.json({ visible, overrides });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
