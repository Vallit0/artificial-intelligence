// ============================================
// Analytics Service
// ============================================

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { getSedeScope } from '../middleware/sedeScope.js';
import { DateRange, createdAtWhere } from '../utils/dateRange.js';

// ============================================
// Desglose de tiempo de práctica por modo
// ============================================
//
// La "primera parte" (Nivel 1) cuenta SÓLO la familia Role-Play Cliente, dentro
// de la cual Prospección es un sub-modo. Los exámenes finales se reportan aparte
// (no son práctica). Las sesiones previas a esta feature no tienen practiceMode
// y caen en `sinClasificar`.

export interface TimeByMode {
  roleplayClienteSeconds: number;   // familia Cliente = cliente + prospección (métrica Nivel 1)
  prospeccionSeconds: number;       // sub-modo de Cliente
  clienteOtrosSeconds: number;      // Cliente que no es prospección
  roleplayObjecionesSeconds: number;
  roleplayAsesorSeconds: number;
  coachSeconds: number;
  examenProspeccionSeconds: number;
  examenObjecionesSeconds: number;
  sinClasificarSeconds: number;
  totalSeconds: number;
}

type SessionModeRow = {
  durationSeconds: number;
  practiceMode: string | null;
  examType: string | null;
};

// Suma puro de duraciones por modo. practiceMode tiene precedencia sobre
// examType (una sesión de práctica nunca trae examType, y viceversa), pero el
// orden lo deja explícito por robustez.
export function aggregateTimeByMode(sessions: SessionModeRow[]): TimeByMode {
  const acc: TimeByMode = {
    roleplayClienteSeconds: 0,
    prospeccionSeconds: 0,
    clienteOtrosSeconds: 0,
    roleplayObjecionesSeconds: 0,
    roleplayAsesorSeconds: 0,
    coachSeconds: 0,
    examenProspeccionSeconds: 0,
    examenObjecionesSeconds: 0,
    sinClasificarSeconds: 0,
    totalSeconds: 0,
  };

  for (const s of sessions) {
    const d = s.durationSeconds || 0;
    acc.totalSeconds += d;

    switch (s.practiceMode) {
      case 'cliente':
        acc.clienteOtrosSeconds += d;
        acc.roleplayClienteSeconds += d;
        continue;
      case 'cliente_prospeccion':
        acc.prospeccionSeconds += d;
        acc.roleplayClienteSeconds += d;
        continue;
      case 'objeciones':
        acc.roleplayObjecionesSeconds += d;
        continue;
      case 'asesor':
        acc.roleplayAsesorSeconds += d;
        continue;
      case 'coach':
        acc.coachSeconds += d;
        continue;
    }

    if (s.examType === 'prospeccion') acc.examenProspeccionSeconds += d;
    else if (s.examType === 'objeciones') acc.examenObjecionesSeconds += d;
    else acc.sinClasificarSeconds += d;
  }

  return acc;
}

// Construye el filtro de sesiones (sólo learners) según el caller:
//   - admin global: todas las sedes (o una si pasa overrideSedeId);
//   - coach (no admin): SÓLO sus alumnos asignados (user.coachId === caller.id);
//   - resto (instructor, etc.): scoped a su sede.
function buildLearnerSessionWhere(caller: AuthUser, overrideSedeId?: string | null) {
  const userWhere: any = { roles: { some: { role: 'learner' } } };

  if (caller.roles.includes('admin')) {
    if (overrideSedeId) userWhere.sedeId = overrideSedeId;
  } else if (caller.roles.includes('coach')) {
    userWhere.coachId = caller.id;
  } else {
    const scope = getSedeScope(caller);
    if (scope.scope === 'sede') userWhere.sedeId = scope.sedeId;
  }

  return { user: userWhere };
}

// ============================================
// User Analytics
// ============================================

export async function getUserAnalytics(userId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [sessions, breakdownAvg, latestBreakdown, activityRaw, modeRows] = await Promise.all([
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

    // Todas las sesiones (cualquier puntaje) para el desglose de tiempo por modo.
    prisma.practiceSession.findMany({
      where: { userId },
      select: { durationSeconds: true, practiceMode: true, examType: true },
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
    timeByMode: aggregateTimeByMode(modeRows),
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

export async function getUsageAnalytics(caller: AuthUser, range?: DateRange) {
  const scope = getSedeScope(caller);
  const userSedeWhere = scope.scope === 'sede' ? { sedeId: scope.sedeId } : {};
  const sessionSedeWhere = scope.scope === 'sede' ? { user: { sedeId: scope.sedeId } } : {};
  const hasRange = !!(range && (range.from || range.to));
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
      where: { user: { roles: { some: { role: 'learner' } } }, ...sessionSedeWhere, ...createdAtWhere(range) },
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
    // Con rango explícito la tendencia cubre todo el período; sin rango se
    // mantiene la ventana de 30 días.
    if (hasRange || sess.createdAt >= thirtyDaysAgo) {
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

// ============================================
// Tiempo por modo (admin/coach) — totales + por alumno
// ============================================
//
// Respeta el alcance del caller (ver buildLearnerSessionWhere). Devuelve el
// desglose total y por alumno para poder mostrar tablas en /admin y en la vista
// del coach (sus alumnos asignados).
export async function getTimeByModeAnalytics(caller: AuthUser, overrideSedeId?: string | null, range?: DateRange) {
  const where = { ...buildLearnerSessionWhere(caller, overrideSedeId), ...createdAtWhere(range) };

  const sessions = await prisma.practiceSession.findMany({
    where,
    select: { durationSeconds: true, practiceMode: true, examType: true, userId: true },
  });

  const totals = aggregateTimeByMode(sessions);

  const byUser = new Map<string, SessionModeRow[]>();
  for (const s of sessions) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId)!.push(s);
  }

  const users = byUser.size
    ? await prisma.user.findMany({
        where: { id: { in: [...byUser.keys()] } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const byStudent = users
    .map(u => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      ...aggregateTimeByMode(byUser.get(u.id)!),
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  return { totals, byStudent };
}

// Desglose de tiempo por modo para un único alumno (dashboard del estudiante).
export async function getUserTimeByMode(userId: string): Promise<TimeByMode> {
  const sessions = await prisma.practiceSession.findMany({
    where: { userId },
    select: { durationSeconds: true, practiceMode: true, examType: true },
  });
  return aggregateTimeByMode(sessions);
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
