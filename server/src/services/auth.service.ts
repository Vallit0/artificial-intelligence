// ============================================
// Authentication Service
// ============================================

import { hashPassword, comparePassword } from '../utils/passwordHash.js';
import jwt from 'jsonwebtoken';
import prisma from '../db/index.js';
import config from '../config/index.js';
import { AuthUser, AppRole, CoachPermissionFlags } from '../types/index.js';
import { BadRequestError, ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

// Carga el user con roles + coachPermissions en un solo round-trip y lo
// proyecta al shape que esperan los middlewares y controllers.
async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { select: { role: true } },
      coachPermissions: {
        select: { canCreateCoaches: true, canEditPrompts: true },
      },
    },
  });
  if (!user) return null;

  const roles = user.roles.map((r) => r.role as AppRole);
  const coachPermissions: CoachPermissionFlags | undefined =
    roles.includes('coach') && user.coachPermissions
      ? {
          canCreateCoaches: user.coachPermissions.canCreateCoaches,
          canEditPrompts: user.coachPermissions.canEditPrompts,
        }
      : roles.includes('coach')
        ? { canCreateCoaches: false, canEditPrompts: false }
        : undefined;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    examenFinalEnabled: user.examenFinalEnabled,
    level2Unlocked: user.level2Unlocked,
    sedeId: user.sedeId,
    roles,
    coachPermissions,
  };
}

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

export async function signup(
  email: string,
  password: string,
  sedeIdOrSlug: string,
  firstName?: string,
  lastName?: string,
  phoneNumber?: string,
): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  if (!email || !password) {
    throw new BadRequestError('Email and password required');
  }
  if (!sedeIdOrSlug || typeof sedeIdOrSlug !== 'string') {
    throw new BadRequestError('Sede es requerida');
  }

  // Acepta sede como UUID o como slug — la UI puede mandar cualquiera.
  // Restringimos a sedes activas para que un slug viejo no resucite una
  // sede deshabilitada.
  const sede = await prisma.sede.findFirst({
    where: {
      isActive: true,
      OR: [{ id: sedeIdOrSlug }, { slug: sedeIdOrSlug }],
    },
    select: { id: true },
  });
  if (!sede) {
    throw new BadRequestError('Sede inválida o inactiva');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('User already exists');
  }

  const passwordHash = await hashPassword(password);

  // Signup público NUNCA crea rol coach — los coaches se crean exclusivamente
  // desde el panel admin (admin global o coach con canCreateCoaches).
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      phoneNumber: phoneNumber || null,
      emailVerified: true,
      sedeId: sede.id,
      roles: {
        create: { role: 'learner' },
      },
    },
  });

  const authUser = await loadAuthUser(user.id);
  if (!authUser) {
    throw new NotFoundError('User not found after signup');
  }

  const accessToken = generateAccessToken(authUser);
  const refreshToken = generateRefreshToken(authUser);

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

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!user.passwordHash) {
    throw new UnauthorizedError('This account uses SSO login');
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const authUser = await loadAuthUser(user.id);
  if (!authUser) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const accessToken = generateAccessToken(authUser);
  const refreshToken = generateRefreshToken(authUser);

  await storeRefreshToken(user.id, refreshToken);

  return { user: authUser, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!refreshToken) {
    throw new BadRequestError('Refresh token required');
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  const authUser = await loadAuthUser(storedToken.userId);
  if (!authUser) {
    throw new NotFoundError('User not found');
  }

  return generateAccessToken(authUser);
}

export async function logout(refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  return loadAuthUser(userId);
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return roles.map(r => r.role as AppRole);
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const found = await prisma.userRole.findUnique({
    where: { userId_role: { userId, role } },
  });
  return !!found;
}

// ============================================
// Helper Functions
// ============================================

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });
}
