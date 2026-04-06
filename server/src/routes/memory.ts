// ============================================
// Memory Routes (ElevenLabs Server Tools)
// ============================================

import { Router } from 'express';
import * as memoryController from '../controllers/memory.controller.js';

export const memoryRouter = Router();

// Public endpoints — called directly by ElevenLabs Server Tools
memoryRouter.post('/retrieve', memoryController.retrieve);
memoryRouter.post('/save', memoryController.save);

// Context endpoint for frontend (builds override prompt)
memoryRouter.post('/context', memoryController.getContext);
