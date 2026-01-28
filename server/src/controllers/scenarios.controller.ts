// ============================================
// Scenarios Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as scenariosService from '../services/scenarios.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// GET /api/scenarios
// ============================================
export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const scenarios = await scenariosService.getAllScenarios();
    res.json(scenarios);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /api/scenarios/:id
// ============================================
export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const scenario = await scenariosService.getScenarioById(req.params.id);
    res.json(scenario);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
