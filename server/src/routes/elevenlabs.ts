// ============================================
// ElevenLabs Routes
// ============================================

import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import * as elevenlabsController from '../controllers/elevenlabs.controller.js';

export const elevenlabsRouter = Router();

// Public token endpoints (needed for free-tier demo).
// optionalAuth is used so the kill-switch can still recognise admin callers.
elevenlabsRouter.post('/conversation-token', optionalAuth, elevenlabsController.getConversationToken);

// Agent evaluation requires authentication
elevenlabsRouter.post('/agent-evaluation', authMiddleware, elevenlabsController.saveAgentEvaluation);
