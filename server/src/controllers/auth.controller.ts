// ============================================
// Authentication Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// POST /auth/signup
// ============================================
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;
    const result = await authService.signup(email, password, firstName, lastName, phoneNumber);
    
    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /auth/login
// ============================================
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /auth/refresh
// ============================================
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const accessToken = await authService.refreshAccessToken(refreshToken);
    
    res.json({ accessToken });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /auth/logout
// ============================================
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// GET /auth/me
// ============================================
export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await authService.getUserRoles(req.user!.id);
    
    res.json({
      user: req.user,
      roles,
    });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
