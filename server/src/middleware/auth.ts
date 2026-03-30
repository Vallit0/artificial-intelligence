// ============================================
// Authentication Middleware
// ============================================

import { Response, NextFunction } from 'express';
import { verifyToken, getUserById } from '../services/auth.service.js';
import { AuthRequest, AuthUser, AppRole } from '../types/index.js';
import { UnauthorizedError, ForbiddenError, handleError } from '../utils/errors.js';
import prisma from '../db/index.js';

// ============================================
// JWT Authentication Middleware
// ============================================

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new UnauthorizedError('Invalid token');
    }

    const user = await getUserById(decoded.sub);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// Role-based Access Control
// ============================================

export function requireRole(...roles: AppRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const userRoles = await prisma.userRole.findMany({
        where: { userId: req.user.id },
        select: { role: true },
      });

      const roleValues = userRoles.map(r => r.role as AppRole);
      const hasRequiredRole = roles.some(role => roleValues.includes(role));

      if (!hasRequiredRole) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({ error: appError.message });
    }
  };
}

// ============================================
// Optional Authentication
// ============================================

export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);

    if (decoded) {
      const user = await getUserById(decoded.sub);
      if (user) {
        req.user = user;
      }
    }
  }

  next();
}
