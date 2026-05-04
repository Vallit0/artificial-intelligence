// ============================================
// Practice Sessions Controller
// ============================================

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as sessionsService from '../services/sessions.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError } from '../utils/errors.js';

// Whitelist what the client can write. score/passed/aiFeedback are NEVER
// accepted from the client — they are only set server-side by the evaluation
// flow (sessions.service.saveEvaluation). Otherwise any authenticated user
// could PATCH their own session and set passed:true to bypass the exam.
const createSessionSchema = z.object({
  scenarioId: z.string().uuid().nullable().optional(),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 4).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  abVariantId: z.string().uuid().nullable().optional(),
});

const updateSessionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(60 * 60 * 4).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  connectMs: z.number().int().min(0).max(120_000).nullable().optional(),
  ttfaSamplesMs: z.array(z.number().int().min(0).max(60_000)).max(500).optional(),
});

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
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Datos de sesión inválidos');
    }
    const session = await sessionsService.createSession(req.user!.id, parsed.data);
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
    const parsed = updateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Datos de sesión inválidos');
    }
    const session = await sessionsService.updateSession(req.params.id, req.user!.id, parsed.data);
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
    }

    res.json(evaluation);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/sessions/:id/transcript
// ============================================
export async function saveTranscript(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { transcript } = req.body;
    await sessionsService.saveTranscript(req.params.id, req.user!.id, transcript);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/sessions/:id/transcript
// ============================================
export async function getTranscript(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await sessionsService.getTranscript(req.params.id, req.user!.id);
    res.json(data);
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
