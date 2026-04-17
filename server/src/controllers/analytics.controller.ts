// ============================================
// Analytics Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// GET /api/analytics/dashboard
// ============================================
export async function getUserDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getUserAnalytics(req.user!.id);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/analytics/competencies
// ============================================
export async function getCompetencyHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getCompetencyHistory(req.user!.id);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/admin/analytics
// ============================================
export async function getAdminAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getGroupAnalytics();
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
