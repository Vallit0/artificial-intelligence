import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function generateToken(user: AuthUser, expiresIn = '1h'): string {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn }
  );
}

export function generateRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);
  
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
    return;
  }

  // Fetch user from database
  const result = await db.query(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [decoded.sub]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Unauthorized - User not found' });
    return;
  }

  req.user = {
    id: result.rows[0].id,
    email: result.rows[0].email,
    fullName: result.rows[0].full_name,
  };

  next();
}

// Check if user has specific role
export async function hasRole(userId: string, role: string): Promise<boolean> {
  const result = await db.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, role]
  );
  return result.rows.length > 0;
}

export async function requireRole(role: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userHasRole = await hasRole(req.user.id, role);
    if (!userHasRole) {
      res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
      return;
    }

    next();
  };
}
