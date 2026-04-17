// ============================================
// A/B Testing Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as abTestingService from '../services/abTesting.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const experiments = await abTestingService.getExperiments();
    res.json(experiments);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const experiment = await abTestingService.getExperimentById(req.params.id);
    res.json(experiment);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const experiment = await abTestingService.createExperiment(req.body);
    res.status(201).json(experiment);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const experiment = await abTestingService.updateExperiment(req.params.id, req.body);
    res.json(experiment);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await abTestingService.deleteExperiment(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

export async function getResults(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const results = await abTestingService.getExperimentResults(req.params.id);
    res.json(results);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
