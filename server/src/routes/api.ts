// ============================================
// API Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as scenariosController from '../controllers/scenarios.controller.js';
import * as sessionsController from '../controllers/sessions.controller.js';
import * as progressController from '../controllers/progress.controller.js';

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

// User Progress
apiRouter.get('/progress', progressController.getProgress);
apiRouter.post('/progress', progressController.updateProgress);

// User Stats
apiRouter.get('/stats', sessionsController.getStats);
