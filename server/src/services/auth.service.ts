// ============================================
// Authentication Service
// ============================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import config from '../config/index.js';
import { AuthUser, AppRole } from '../types/index.js';
import { BadRequestError, ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

// ============================================
// Token Management
// ============================================

export function generateAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiry }
  );
}

export function generateRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );
}

export function verifyToken(token: string): { sub: string; email?: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { sub: string; email?: string };
  } catch {
    return null;
  }
}

// ============================================
// User Authentication
// ============================================

export async function signup(email: string, password: string, fullName?: string): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  if (!email || !password) {
    throw new BadRequestError('Email and password required');
  }

  // Check if user exists
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new ConflictError('User already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const result = await db.query(
    `INSERT INTO users (email, password_hash, full_name, email_verified)
     VALUES ($1, $2, $3, true)
     RETURNING id, email, full_name`,
    [email, passwordHash, fullName || null]
  );

  const user = result.rows[0];

  // Assign default role
  await db.query(
    'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
    [user.id, 'learner']
  );

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  };

  // Generate tokens
  const accessToken = generateAccessToken(authUser);
  const refreshToken = generateRefreshToken(authUser);

  // Store refresh token
  await storeRefreshToken(user.id, refreshToken);

  return { user: authUser, accessToken, refreshToken };
}

export async function login(email: string, password: string): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  if (!email || !password) {
    throw new BadRequestError('Email and password required');
  }

  // Find user
  const result = await db.query(
    'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const user = result.rows[0];

  // Check password
  if (!user.password_hash) {
    throw new UnauthorizedError('This account uses SSO login');
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  };

  // Generate tokens
  const accessToken = generateAccessToken(authUser);
  const refreshToken = generateRefreshToken(authUser);

  // Store refresh token
  await storeRefreshToken(user.id, refreshToken);

  return { user: authUser, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!refreshToken) {
    throw new BadRequestError('Refresh token required');
  }

  // Verify token format
  const decoded = verifyToken(refreshToken);
  if (!decoded) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token exists in database
  const tokenResult = await db.query(
    'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  );

  if (tokenResult.rows.length === 0) {
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  // Get user
  const userResult = await db.query(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [tokenResult.rows[0].user_id]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = userResult.rows[0];

  return generateAccessToken({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  });
}

export async function logout(refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const result = await db.query(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    fullName: result.rows[0].full_name,
  };
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const result = await db.query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  return result.rows.map(r => r.role as AppRole);
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const result = await db.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, role]
  );
  return result.rows.length > 0;
}

// ============================================
// Helper Functions
// ============================================

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}
