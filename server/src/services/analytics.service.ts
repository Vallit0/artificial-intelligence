// ============================================
// Analytics Service
// ============================================

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { getSedeScope } from '../middleware/sedeScope.js';

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

export async function getGroupAnalytics(caller: AuthUser) {
  const scope = getSedeScope(caller);
  // El filtro por sede para los aggregates de evaluationBreakdown se hace
  // vía la relación session → user → sede.
  const breakdownWhere = scope.scope === 'sede'
    ? { session: { user: { sedeId: scope.sedeId } } }
    : {};

  const [overallBreakdown, studentStats, activityTrend] = await Promise.all([
    prisma.evaluationBreakdown.aggregate({
      where: breakdownWhere,
      _avg: {
        apertura: true,
        escuchaActiva: true,
        manejoObjeciones: true,
        propuestaValor: true,
        cierre: true,
      },
    }),
    getPerStudentAverages(caller),
    getActivityTrend(caller),
  ]);

  return {
    overallBreakdown: overallBreakdown._avg,
    studentStats,
    activityTrend,
  };
}

async function getPerStudentAverages(caller: AuthUser) {
  const scope = getSedeScope(caller);
  const students = await prisma.user.findMany({
    where: {
      ...(scope.scope === 'sede' ? { sedeId: scope.sedeId } : {}),
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

// ============================================
// Usage Analytics (por sede) — métricas de USO, sin calificaciones
// ============================================
//
// Agrega tiempo total, sesiones y estudiantes activos por sede. Respeta el
// alcance de sede: admin global ve todas las sedes; un coach/instructor sólo
// la suya. No incluye ningún dato de puntajes/competencias por diseño.

export async function getUsageAnalytics(caller: AuthUser) {
  const scope = getSedeScope(caller);
  const userSedeWhere = scope.scope === 'sede' ? { sedeId: scope.sedeId } : {};
  const sessionSedeWhere = scope.scope === 'sede' ? { user: { sedeId: scope.sedeId } } : {};
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [sedes, learners, sessions] = await Promise.all([
    prisma.sede.findMany({
      where: scope.scope === 'sede' ? { id: scope.sedeId } : { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: 'learner' } }, ...userSedeWhere },
      select: { id: true, sedeId: true },
    }),
    prisma.practiceSession.findMany({
      where: { user: { roles: { some: { role: 'learner' } } }, ...sessionSedeWhere },
      select: { durationSeconds: true, userId: true, createdAt: true },
    }),
  ]);

  // userId -> sedeId, para imputar cada sesión a una sede.
  const userSede = new Map(learners.map(l => [l.id, l.sedeId]));

  type SedeAcc = {
    sedeId: string;
    sedeName: string;
    totalTimeSeconds: number;
    totalSessions: number;
    activeStudentIds: Set<string>;
    totalStudents: number;
  };
  const bySedeMap = new Map<string, SedeAcc>();
  for (const s of sedes) {
    bySedeMap.set(s.id, {
      sedeId: s.id,
      sedeName: s.name,
      totalTimeSeconds: 0,
      totalSessions: 0,
      activeStudentIds: new Set(),
      totalStudents: 0,
    });
  }

  for (const l of learners) {
    if (l.sedeId && bySedeMap.has(l.sedeId)) {
      bySedeMap.get(l.sedeId)!.totalStudents++;
    }
  }

  const dailyCounts: Record<string, number> = {};
  for (const sess of sessions) {
    const sedeId = userSede.get(sess.userId);
    if (sedeId && bySedeMap.has(sedeId)) {
      const acc = bySedeMap.get(sedeId)!;
      acc.totalTimeSeconds += sess.durationSeconds;
      acc.totalSessions++;
      acc.activeStudentIds.add(sess.userId);
    }
    if (sess.createdAt >= thirtyDaysAgo) {
      const dateKey = sess.createdAt.toISOString().split('T')[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  }

  const bySede = Array.from(bySedeMap.values())
    .map(a => ({
      sedeId: a.sedeId,
      sedeName: a.sedeName,
      totalTimeSeconds: a.totalTimeSeconds,
      totalSessions: a.totalSessions,
      activeStudents: a.activeStudentIds.size,
      totalStudents: a.totalStudents,
    }))
    .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);

  const totals = {
    totalTimeSeconds: bySede.reduce((s, x) => s + x.totalTimeSeconds, 0),
    totalSessions: bySede.reduce((s, x) => s + x.totalSessions, 0),
    activeStudents: bySede.reduce((s, x) => s + x.activeStudents, 0),
    totalStudents: bySede.reduce((s, x) => s + x.totalStudents, 0),
  };

  const activityTrend = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totals, bySede, activityTrend };
}

async function getActivityTrend(caller: AuthUser) {
  const scope = getSedeScope(caller);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.practiceSession.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      ...(scope.scope === 'sede' ? { user: { sedeId: scope.sedeId } } : {}),
    },
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
