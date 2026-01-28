// ============================================
// ElevenLabs Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as elevenlabsController from '../controllers/elevenlabs.controller.js';

export const elevenlabsRouter = Router();

// All ElevenLabs routes require authentication
elevenlabsRouter.use(authMiddleware);

// Token endpoints
elevenlabsRouter.post('/conversation-token', elevenlabsController.getConversationToken);
elevenlabsRouter.post('/scribe-token', elevenlabsController.getScribeToken);

// Agent evaluation webhook
elevenlabsRouter.post('/agent-evaluation', elevenlabsController.saveAgentEvaluation);
