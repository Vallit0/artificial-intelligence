// ============================================
// Analytics Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';
import { parseDateRange } from '../utils/dateRange.js';

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
    const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : null;
    const data = await analyticsService.getGroupAnalytics(req.user!, divisionId);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/admin/analytics/usage
// ============================================
export async function getAdminUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const range = parseDateRange(req.query);
    const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : null;
    const data = await analyticsService.getUsageAnalytics(req.user!, range, divisionId);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/admin/analytics/time-by-mode
// ============================================
// Desglose del tiempo de práctica por modo (Role-Play Cliente y su sub-modo
// Prospección, Objeciones, Asesor, Coach, exámenes y Sin clasificar).
// Admin global ve todo (o una sede vía ?sedeId); un coach ve sólo sus alumnos
// asignados.
export async function getTimeByMode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sedeId = typeof req.query.sedeId === 'string' ? req.query.sedeId : null;
    const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : null;
    const range = parseDateRange(req.query);
    const data = await analyticsService.getTimeByModeAnalytics(req.user!, sedeId, range, divisionId);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
