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
import * as sedesService from '../services/sedes.service.js';
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
apiRouter.get('/sedes', async (req: AuthRequest, res: Response) => {
  try {
    const sedes = await sedesService.listSedes();
    res.json(sedes.map((s) => ({ id: s.id, slug: s.slug, name: s.name, country: s.country })));
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
apiRouter.get('/progress', progressController.getProgress);
apiRouter.post('/progress', progressController.updateProgress);

// User Stats
apiRouter.get('/stats', sessionsController.getStats);

// Analytics
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

// Prospecting Scenarios visible to current user
apiRouter.get('/prospecting-scenarios/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const visible = await prospectingScenariosService.getVisibleSecretNamesForUser(userId);
    res.json({ visible });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
