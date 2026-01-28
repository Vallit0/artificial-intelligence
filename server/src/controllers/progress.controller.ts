// ============================================
// User Progress Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as progressService from '../services/progress.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// GET /api/progress
// ============================================
export async function getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const progress = await progressService.getUserProgress(req.user!.id);
    res.json(progress);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/progress
// ============================================
export async function updateProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scenarioId, isUnlocked, isCompleted, bestScore, attempts } = req.body;
    
    const progress = await progressService.upsertProgress(req.user!.id, scenarioId, {
      isUnlocked,
      isCompleted,
      bestScore,
      attempts,
    });
    
    res.json(progress);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
