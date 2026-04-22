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
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

export const apiRouter = Router();

// ============================================
// Public Routes
// ============================================

// Scenarios (public for listing)
apiRouter.get('/scenarios', scenariosController.getAll);
apiRouter.get('/scenarios/:id', scenariosController.getById);

// ============================================
// Protected Routes
// ============================================

apiRouter.use(authMiddleware);

// Practice Sessions
apiRouter.get('/sessions', sessionsController.getAll);
apiRouter.post('/sessions', sessionsController.create);
apiRouter.patch('/sessions/:id', sessionsController.update);
apiRouter.post('/sessions/evaluate', sessionsController.evaluate);
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
