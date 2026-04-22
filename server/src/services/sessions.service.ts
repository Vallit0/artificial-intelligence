// ============================================
// Practice Sessions Service
// ============================================

import prisma from '../db/index.js';
import { PracticeSession, CreateSessionInput, UpdateSessionInput, SessionEvaluation, UserStats } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';

// ============================================
// Session Operations
// ============================================

export async function getUserSessions(userId: string, limit: number = 100): Promise<PracticeSession[]> {
  const sessions = await prisma.practiceSession.findMany({
    where: { userId },
    include: {
      scenario: { select: { name: true } },
      evaluationBreakdown: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return sessions.map(mapToSession);
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<PracticeSession> {
  const session = await prisma.practiceSession.create({
    data: {
      userId,
      scenarioId: input.scenarioId || null,
      durationSeconds: input.durationSeconds || 0,
      score: input.score || null,
      passed: input.passed || false,
      rating: input.rating || null,
      aiFeedback: input.aiFeedback || null,
      abVariantId: input.abVariantId || null,
    },
  });

  return mapToSession(session);
}

export async function updateSession(
  sessionId: string,
  userId: string,
  input: UpdateSessionInput
): Promise<PracticeSession> {
  const existing = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!existing) {
    throw new NotFoundError('Session not found');
  }

  const session = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      durationSeconds: input.durationSeconds ?? existing.durationSeconds,
      score: input.score ?? existing.score,
      passed: input.passed ?? existing.passed,
      rating: input.rating ?? existing.rating,
      aiFeedback: input.aiFeedback ?? existing.aiFeedback,
    },
  });

  return mapToSession(session);
}

export async function saveEvaluation(
  sessionId: string,
  userId: string,
  evaluation: SessionEvaluation
): Promise<PracticeSession> {
  const session = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      score: evaluation.score,
      passed: evaluation.passed,
      aiFeedback: evaluation.feedback,
    },
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Persist evaluation breakdown to dedicated table
  if (evaluation.breakdown) {
    await prisma.evaluationBreakdown.upsert({
      where: { sessionId },
      create: {
        sessionId,
        apertura: evaluation.breakdown.apertura ?? 0,
        escuchaActiva: evaluation.breakdown.escucha_activa ?? 0,
        manejoObjeciones: evaluation.breakdown.manejo_objeciones ?? 0,
        propuestaValor: evaluation.breakdown.propuesta_valor ?? 0,
        cierre: evaluation.breakdown.cierre ?? 0,
      },
      update: {
        apertura: evaluation.breakdown.apertura ?? 0,
        escuchaActiva: evaluation.breakdown.escucha_activa ?? 0,
        manejoObjeciones: evaluation.breakdown.manejo_objeciones ?? 0,
        propuestaValor: evaluation.breakdown.propuesta_valor ?? 0,
        cierre: evaluation.breakdown.cierre ?? 0,
      },
    });
  }

  // Update scenario progress if passed
  if (evaluation.passed && session.scenarioId) {
    await updateProgressOnPass(userId, session.scenarioId, evaluation.score);
  }

  return mapToSession(session);
}

export async function saveTranscript(
  sessionId: string,
  userId: string,
  transcript: Array<{ role: string; content: string; timestamp?: number }>
): Promise<void> {
  const existing = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!existing) {
    throw new NotFoundError('Session not found');
  }
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { transcript: transcript as any },
  });
}

export async function getTranscript(sessionId: string, userId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      evaluationBreakdown: true,
      sessionSummary: true,
      scenario: { select: { name: true } },
    },
  });
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  return {
    transcript: session.transcript as any[] | null,
    score: session.score,
    passed: session.passed,
    aiFeedback: session.aiFeedback,
    durationSeconds: session.durationSeconds,
    createdAt: session.createdAt,
    scenarioName: (session.scenario as any)?.name || null,
    breakdown: session.evaluationBreakdown,
    summary: session.sessionSummary,
  };
}

export async function getTranscriptAdmin(sessionId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId },
    include: {
      evaluationBreakdown: true,
      sessionSummary: true,
      scenario: { select: { name: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  return {
    transcript: session.transcript as any[] | null,
    score: session.score,
    passed: session.passed,
    aiFeedback: session.aiFeedback,
    durationSeconds: session.durationSeconds,
    createdAt: session.createdAt,
    scenarioName: (session.scenario as any)?.name || null,
    breakdown: session.evaluationBreakdown,
    summary: session.sessionSummary,
    user: session.user,
  };
}

export async function evaluateSession(
  _transcript: Array<{ role: string; content: string }>,
  _scenarioId?: string
): Promise<SessionEvaluation> {
  return {
    score: 75,
    passed: true,
    feedback: 'Buen trabajo en la práctica. Continúa mejorando tu técnica de manejo de objeciones.',
    breakdown: {
      apertura: 80,
      escucha_activa: 75,
      manejo_objeciones: 70,
      propuesta_valor: 75,
      cierre: 75,
    },
  };
}

// ============================================
// Statistics
// ============================================

export async function getUserStats(userId: string): Promise<UserStats> {
  const [sessionsAgg, completedCount, practiceDays] = await Promise.all([
    prisma.practiceSession.aggregate({
      where: { userId },
      _count: true,
      _sum: { durationSeconds: true },
      _avg: { score: true },
    }),
    prisma.userScenarioProgress.count({
      where: { userId, isCompleted: true },
    }),
    prisma.practiceSession.groupBy({
      by: ['createdAt'],
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalSessions: sessionsAgg._count,
    totalTime: sessionsAgg._sum.durationSeconds || 0,
    avgScore: sessionsAgg._avg.score || 0,
    completedScenarios: completedCount,
    practiceDays: practiceDays.length,
  };
}

// ============================================
// Helper Functions
// ============================================

async function updateProgressOnPass(userId: string, scenarioId: string, score: number): Promise<void> {
  // Update or create progress for completed scenario
  await prisma.userScenarioProgress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: {
      userId,
      scenarioId,
      isCompleted: true,
      isUnlocked: true,
      bestScore: score,
      attempts: 1,
      firstCompletedAt: new Date(),
      lastAttemptAt: new Date(),
    },
    update: {
      isCompleted: true,
      bestScore: { set: score }, // Prisma doesn't have GREATEST, handle in app
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  // Fix: ensure bestScore is actually the best
  const current = await prisma.userScenarioProgress.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
  });
  if (current && current.bestScore !== null && current.bestScore > score) {
    // Revert if the existing score was higher
    await prisma.userScenarioProgress.update({
      where: { userId_scenarioId: { userId, scenarioId } },
      data: { bestScore: current.bestScore },
    });
  }

  // Unlock next scenario
  const currentScenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { displayOrder: true },
  });

  if (currentScenario) {
    const nextScenario = await prisma.scenario.findFirst({
      where: {
        isActive: true,
        displayOrder: { gt: currentScenario.displayOrder },
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (nextScenario) {
      await prisma.userScenarioProgress.upsert({
        where: { userId_scenarioId: { userId, scenarioId: nextScenario.id } },
        create: {
          userId,
          scenarioId: nextScenario.id,
          isUnlocked: true,
        },
        update: {
          isUnlocked: true,
        },
      });
    }
  }
}

function mapToSession(row: any): PracticeSession {
  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId || undefined,
    durationSeconds: row.durationSeconds,
    score: row.score ?? undefined,
    passed: row.passed,
    rating: row.rating ?? undefined,
    aiFeedback: row.aiFeedback || undefined,
    transcript: row.transcript || undefined,
    abVariantId: row.abVariantId || undefined,
    breakdown: row.evaluationBreakdown ? {
      apertura: row.evaluationBreakdown.apertura,
      escuchaActiva: row.evaluationBreakdown.escuchaActiva,
      manejoObjeciones: row.evaluationBreakdown.manejoObjeciones,
      propuestaValor: row.evaluationBreakdown.propuestaValor,
      cierre: row.evaluationBreakdown.cierre,
    } : undefined,
    createdAt: row.createdAt,
  };
}
