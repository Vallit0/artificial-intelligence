// ============================================
// Memory Controller (ElevenLabs Server Tools)
// ============================================

import { Request, Response } from 'express';
import * as memoryService from '../services/memory.service.js';
import { handleError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { checkToolSecret } from '../middleware/toolSecret.js';
import { getLogger } from '../utils/logger.js';
import { AuthRequest } from '../types/index.js';

// Empty-but-valid payload the agent can consume so its turn continues without
// personalized memory. Shape matches memoryService.retrieveMemories().
const EMPTY_MEMORY = { memories: [], last_session: null } as const;

// ============================================
// POST /api/memory/retrieve
// Called by ElevenLabs Server Tool (Wait for response)
// ============================================
export async function retrieve(req: Request, res: Response): Promise<void> {
  const log = getLogger({ component: 'memory', op: 'retrieve' });

  // This runs mid-conversation as a "Wait for response" tool: ElevenLabs blocks
  // the agent's turn until we answer. A 401/500/400 here HANGS the agent right
  // after the greeting ("se escucha el primer texto pero no responde"), so on
  // ANY failure we degrade to an empty-but-valid 200 instead of erroring. The
  // conversation keeps going without memory and nothing leaks (empty payload);
  // ops sees the warning to fix the tool's X-Tool-Secret header.
  const secret = checkToolSecret(req);
  if (!secret.ok) {
    log.warn(
      { reason: secret.reason },
      'tool secret check failed — returning empty memory so the agent turn does not hang',
    );
    res.json(EMPTY_MEMORY);
    return;
  }

  const { user_id, category, limit } = req.body;
  if (!user_id) {
    log.warn('retrieve called without user_id — returning empty memory');
    res.json(EMPTY_MEMORY);
    return;
  }

  try {
    const result = await memoryService.retrieveMemories(
      user_id,
      category || undefined,
      limit || 20
    );
    res.json(result);
  } catch (error) {
    // Prefer an empty 200 over a 500 that would freeze the live conversation.
    log.error({ err: error }, 'retrieve failed — returning empty memory to avoid hanging the agent');
    res.json(EMPTY_MEMORY);
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
