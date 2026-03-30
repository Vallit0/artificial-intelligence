// ============================================
// Admin Service
// ============================================

import bcrypt from 'bcryptjs';
import prisma from '../db/index.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

interface CreateUserInput {
  email: string;
  password: string;
  fullName?: string;
  isAdmin?: boolean;
}

interface StudentWithStats {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: Date;
  totalSessions: number;
  totalDuration: number;
  averageScore: number | null;
  finalGrade: number | null;
  gradedBy: string | null;
  gradeNotes: string | null;
}

// ============================================
// User Management
// ============================================

export async function createUser(input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    throw new BadRequestError('Formato de email inválido');
  }
  if (!input.password || input.password.length < 6) {
    throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Este email ya está registrado');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: input.fullName?.trim() || null,
      emailVerified: true,
      roles: {
        create: { role: input.isAdmin ? 'admin' : 'learner' },
      },
    },
  });

  // If admin, also add learner role
  if (input.isAdmin) {
    await prisma.userRole.create({
      data: { userId: user.id, role: 'learner' },
    }).catch(() => {}); // ignore if already exists
  }

  return { id: user.id, email: user.email };
}

export async function bulkCreateUsers(users: CreateUserInput[]) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    throw new BadRequestError('Se requiere un array de usuarios');
  }
  if (users.length > 100) {
    throw new BadRequestError('Máximo 100 usuarios por lote');
  }

  const existingUsers = await prisma.user.findMany({
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const userData of users) {
    try {
      const email = userData.email?.trim().toLowerCase();

      if (!email || !isValidEmail(email)) {
        results.push({ email: email || 'desconocido', success: false, error: 'Email inválido' });
        continue;
      }
      if (!userData.password || userData.password.length < 6) {
        results.push({ email, success: false, error: 'Contraseña muy corta' });
        continue;
      }
      if (existingEmails.has(email)) {
        results.push({ email, success: false, error: 'Usuario ya existe' });
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, 12);
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: userData.fullName?.trim() || null,
          emailVerified: true,
          roles: { create: { role: 'learner' } },
        },
      });

      existingEmails.add(email);
      results.push({ email, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      results.push({ email: userData.email || 'desconocido', success: false, error: message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return {
    summary: { total: users.length, created: successCount, failed: failCount },
    results,
  };
}

export async function deleteUser(userId: string, adminUserId: string) {
  if (userId === adminUserId) {
    throw new BadRequestError('No puedes eliminar tu propia cuenta');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }

  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

export async function updateUserPassword(userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true };
}

// ============================================
// Student Management
// ============================================

export async function getAllStudents(): Promise<StudentWithStats[]> {
  const users = await prisma.user.findMany({
    include: {
      practiceSessions: {
        select: { durationSeconds: true, score: true },
      },
      studentGrade: {
        select: { finalGrade: true, gradedBy: true, notes: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map(user => {
    const sessions = user.practiceSessions;
    const scores = sessions.map(s => s.score).filter((s): s is number => s !== null);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      totalSessions: sessions.length,
      totalDuration: sessions.reduce((acc, s) => acc + s.durationSeconds, 0),
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      finalGrade: user.studentGrade ? Number(user.studentGrade.finalGrade) : null,
      gradedBy: user.studentGrade?.gradedBy || null,
      gradeNotes: user.studentGrade?.notes || null,
    };
  });
}

export async function upsertGrade(userId: string, gradedBy: string, finalGrade: number, notes?: string) {
  if (finalGrade < 0 || finalGrade > 100) {
    throw new BadRequestError('La calificación debe estar entre 0 y 100');
  }

  return prisma.studentGrade.upsert({
    where: { userId },
    create: { userId, gradedBy, finalGrade, notes: notes || null },
    update: { gradedBy, finalGrade, notes: notes || null },
  });
}

// ============================================
// Helpers
// ============================================

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
