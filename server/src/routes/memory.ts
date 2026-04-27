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
memoryRouter.post('/retrieve', requireToolSecret, memoryController.retrieve);
memoryRouter.post('/save', requireToolSecret, memoryController.save);

// Context endpoint for frontend — requires user auth, body.user_id must match req.user.id.
memoryRouter.post('/context', authMiddleware, memoryController.getContext);
