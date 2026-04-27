// ============================================
// Memory Controller (ElevenLabs Server Tools)
// ============================================

import { Request, Response } from 'express';
import * as memoryService from '../services/memory.service.js';
import { handleError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { AuthRequest } from '../types/index.js';

// ============================================
// POST /api/memory/retrieve
// Called by ElevenLabs Server Tool (Wait for response)
// ============================================
export async function retrieve(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, category, limit } = req.body;

    if (!user_id) {
      throw new BadRequestError('user_id is required');
    }

    const result = await memoryService.retrieveMemories(
      user_id,
      category || undefined,
      limit || 20
    );

    res.json(result);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/memory/save
// Called by ElevenLabs Server Tool during conversation
// ============================================
export async function save(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, content, category, importance } = req.body;

    if (!user_id || !content || !category) {
      throw new BadRequestError('user_id, content, and category are required');
    }

    const validCategories = ['debilidad', 'fortaleza', 'expresion', 'comportamiento', 'progreso'];
    if (!validCategories.includes(category)) {
      throw new BadRequestError(`category must be one of: ${validCategories.join(', ')}`);
    }

    const memory = await memoryService.saveMemory(
      user_id,
      content,
      category,
      importance || 5,
      'agent'
    );

    res.json({ success: true, memory_id: memory.id });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/memory/context
// Called by frontend to get agent override context
// ============================================
export async function getContext(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      throw new BadRequestError('user_id is required');
    }

    // Prevent IDOR: a user can only fetch their own memory context.
    if (!req.user || req.user.id !== user_id) {
      throw new ForbiddenError('Cannot read another user\'s memory context');
    }

    const context = await memoryService.buildAgentContext(user_id);

    res.json({ context });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
