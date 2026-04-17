// ============================================
// Analytics Service
// ============================================

import prisma from '../db/index.js';

// ============================================
// User Analytics
// ============================================

export async function getUserAnalytics(userId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [sessions, breakdownAvg, latestBreakdown, activityRaw] = await Promise.all([
    // Score progression with breakdowns
    prisma.practiceSession.findMany({
      where: { userId, score: { not: null } },
      include: {
        evaluationBreakdown: true,
        scenario: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    // Average breakdown across all sessions
    prisma.evaluationBreakdown.aggregate({
      where: { session: { userId } },
      _avg: {
        apertura: true,
        escuchaActiva: true,
        manejoObjeciones: true,
        propuestaValor: true,
        cierre: true,
      },
    }),

    // Latest breakdown
    prisma.evaluationBreakdown.findFirst({
      where: { session: { userId } },
      orderBy: { createdAt: 'desc' },
    }),

    // Activity data for heatmap (last 90 days)
    prisma.practiceSession.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build score progression
  const scoreHistory = sessions.map(s => ({
    date: s.createdAt.toISOString(),
    score: s.score!,
    scenarioName: (s.scenario as any)?.name || 'Práctica libre',
    breakdown: s.evaluationBreakdown ? {
      apertura: s.evaluationBreakdown.apertura,
      escuchaActiva: s.evaluationBreakdown.escuchaActiva,
      manejoObjeciones: s.evaluationBreakdown.manejoObjeciones,
      propuestaValor: s.evaluationBreakdown.propuestaValor,
      cierre: s.evaluationBreakdown.cierre,
    } : null,
  }));

  // Build activity heatmap (count sessions per date)
  const activityMap: Record<string, number> = {};
  for (const s of activityRaw) {
    const dateKey = s.createdAt.toISOString().split('T')[0];
    activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
  }
  const activityHeatmap = Object.entries(activityMap).map(([date, count]) => ({ date, count }));

  return {
    scoreHistory,
    averageBreakdown: breakdownAvg._avg,
    latestBreakdown: latestBreakdown ? {
      apertura: latestBreakdown.apertura,
      escuchaActiva: latestBreakdown.escuchaActiva,
      manejoObjeciones: latestBreakdown.manejoObjeciones,
      propuestaValor: latestBreakdown.propuestaValor,
      cierre: latestBreakdown.cierre,
    } : null,
    activityHeatmap,
  };
}

// ============================================
// Competency History (per-session breakdown over time)
// ============================================

export async function getCompetencyHistory(userId: string) {
  const breakdowns = await prisma.evaluationBreakdown.findMany({
    where: { session: { userId } },
    include: { session: { select: { createdAt: true, score: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return breakdowns.map(b => ({
    date: b.session.createdAt.toISOString(),
    score: b.session.score,
    apertura: b.apertura,
    escuchaActiva: b.escuchaActiva,
    manejoObjeciones: b.manejoObjeciones,
    propuestaValor: b.propuestaValor,
    cierre: b.cierre,
  }));
}

// ============================================
// Admin Group Analytics
// ============================================

export async function getGroupAnalytics() {
  const [overallBreakdown, studentStats, activityTrend] = await Promise.all([
    // Overall average breakdown
    prisma.evaluationBreakdown.aggregate({
      _avg: {
        apertura: true,
        escuchaActiva: true,
        manejoObjeciones: true,
        propuestaValor: true,
        cierre: true,
      },
    }),

    // Per-student averages
    getPerStudentAverages(),

    // Activity trend (sessions per day, last 30 days)
    getActivityTrend(),
  ]);

  return {
    overallBreakdown: overallBreakdown._avg,
    studentStats,
    activityTrend,
  };
}

async function getPerStudentAverages() {
  const students = await prisma.user.findMany({
    where: {
      roles: { some: { role: 'learner' } },
      practiceSessions: { some: { score: { not: null } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      practiceSessions: {
        where: { score: { not: null } },
        select: {
          score: true,
          evaluationBreakdown: true,
        },
      },
    },
  });

  return students.map(student => {
    const sessions = student.practiceSessions;
    const totalSessions = sessions.length;
    const avgScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalSessions;

    const breakdowns = sessions
      .map(s => s.evaluationBreakdown)
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const avgBreakdown = breakdowns.length > 0 ? {
      apertura: breakdowns.reduce((sum, b) => sum + b.apertura, 0) / breakdowns.length,
      escuchaActiva: breakdowns.reduce((sum, b) => sum + b.escuchaActiva, 0) / breakdowns.length,
      manejoObjeciones: breakdowns.reduce((sum, b) => sum + b.manejoObjeciones, 0) / breakdowns.length,
      propuestaValor: breakdowns.reduce((sum, b) => sum + b.propuestaValor, 0) / breakdowns.length,
      cierre: breakdowns.reduce((sum, b) => sum + b.cierre, 0) / breakdowns.length,
    } : null;

    return {
      id: student.id,
      name: [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email,
      totalSessions,
      avgScore: Math.round(avgScore),
      avgBreakdown,
    };
  }).sort((a, b) => b.avgScore - a.avgScore);
}

async function getActivityTrend() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.practiceSession.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyCounts: Record<string, number> = {};
  for (const s of sessions) {
    const dateKey = s.createdAt.toISOString().split('T')[0];
    dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
  }

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
}
