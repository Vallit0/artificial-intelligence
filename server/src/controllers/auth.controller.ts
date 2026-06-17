// ============================================
// Authentication Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import prisma from '../db/index.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

// ============================================
// POST /auth/signup
// ============================================
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName, phoneNumber, sede, sedeId, coachId } = req.body;
    // Aceptamos `sede` (UUID o slug) o `sedeId` (UUID) — la UI puede mandar
    // cualquiera de los dos, ambas formas resuelven contra Sede en el servicio.
    const sedeRef = sede ?? sedeId;
    const result = await authService.signup(email, password, sedeRef, coachId, firstName, lastName, phoneNumber);

    // Auto-registro con aprobación: NO se emiten tokens. El usuario queda
    // pendiente del visto bueno de un admin/coach de su sede.
    res.status(201).json({
      status: result.status,
      email: result.email,
      message: 'Registro recibido. Tu cuenta queda pendiente de aprobación.',
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

    // Datos de display (sede + coach asignado) sólo para /auth/me — no se
    // cargan en loadAuthUser para no meter joins en el hot path de cada request.
    const profile = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        sede: { select: { id: true, name: true } },
        coach: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const coach = profile?.coach
      ? {
          id: profile.coach.id,
          name:
            [profile.coach.firstName, profile.coach.lastName].filter(Boolean).join(' ') ||
            profile.coach.email,
        }
      : null;

    res.json({
      user: { ...req.user, sede: profile?.sede ?? null, coach },
      roles,
    });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
