// ============================================
// User Progress Service
// ============================================

import prisma from '../db/index.js';
import { UserProgress } from '../types/index.js';

// ============================================
// Progress Operations
// ============================================

export async function getUserProgress(userId: string): Promise<UserProgress[]> {
  const progress = await prisma.userScenarioProgress.findMany({
    where: { userId },
    include: { scenario: { select: { name: true, displayOrder: true } } },
    orderBy: { scenario: { displayOrder: 'asc' } },
  });

  return progress.map(mapToProgress);
}

export async function upsertProgress(
  userId: string,
  scenarioId: string,
  input: {
    isUnlocked?: boolean;
    isCompleted?: boolean;
    bestScore?: number;
    attempts?: number;
  }
): Promise<UserProgress> {
  const result = await prisma.userScenarioProgress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: {
      userId,
      scenarioId,
      isUnlocked: input.isUnlocked || false,
      isCompleted: input.isCompleted || false,
      bestScore: input.bestScore || null,
      attempts: input.attempts || 0,
      lastAttemptAt: new Date(),
      firstCompletedAt: input.isCompleted ? new Date() : null,
    },
    update: {
      isUnlocked: input.isUnlocked ?? undefined,
      isCompleted: input.isCompleted ?? undefined,
      bestScore: input.bestScore ?? undefined,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  return mapToProgress(result);
}

export async function getScenarioProgress(userId: string, scenarioId: string): Promise<UserProgress | null> {
  const progress = await prisma.userScenarioProgress.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
  });

  if (!progress) return null;
  return mapToProgress(progress);
}

export async function unlockFirstScenario(userId: string): Promise<void> {
  const firstScenario = await prisma.scenario.findFirst({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  if (!firstScenario) return;

  await prisma.userScenarioProgress.upsert({
    where: { userId_scenarioId: { userId, scenarioId: firstScenario.id } },
    create: {
      userId,
      scenarioId: firstScenario.id,
      isUnlocked: true,
    },
    update: {},
  });
}

// ============================================
// Helper Functions
// ============================================

function mapToProgress(row: any): UserProgress {
  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId,
    isUnlocked: row.isUnlocked,
    isCompleted: row.isCompleted,
    bestScore: row.bestScore ?? undefined,
    attempts: row.attempts,
    firstCompletedAt: row.firstCompletedAt || undefined,
    lastAttemptAt: row.lastAttemptAt || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
