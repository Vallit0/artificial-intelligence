// ============================================
// ElevenLabs Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as elevenlabsController from '../controllers/elevenlabs.controller.js';

export const elevenlabsRouter = Router();

// Public token endpoints (needed for free-tier demo)
elevenlabsRouter.post('/conversation-token', elevenlabsController.getConversationToken);

// Agent evaluation requires authentication
elevenlabsRouter.post('/agent-evaluation', authMiddleware, elevenlabsController.saveAgentEvaluation);
