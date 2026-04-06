// ============================================
// Practice Sessions Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as sessionsService from '../services/sessions.service.js';
import * as memoryService from '../services/memory.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// GET /api/sessions
// ============================================
export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessions = await sessionsService.getUserSessions(req.user!.id);
    res.json(sessions);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/sessions
// ============================================
export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await sessionsService.createSession(req.user!.id, req.body);
    res.status(201).json(session);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// PATCH /api/sessions/:id
// ============================================
export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await sessionsService.updateSession(req.params.id, req.user!.id, req.body);
    res.json(session);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/sessions/evaluate
// ============================================
export async function evaluate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, transcript, scenarioId, durationSeconds } = req.body;
    
    // Get AI evaluation
    const evaluation = await sessionsService.evaluateSession(transcript, scenarioId);
    
    // Save to session if ID provided
    if (sessionId) {
      await sessionsService.saveEvaluation(sessionId, req.user!.id, evaluation);

      // Fire-and-forget: generate session summary + extract memories
      memoryService.generateSessionSummary(
        sessionId,
        req.user!.id,
        transcript,
        scenarioId,
        evaluation
      ).catch(err => console.error('Session summary generation failed:', err));
    }

    res.json(evaluation);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/stats
// ============================================
export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await sessionsService.getUserStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
