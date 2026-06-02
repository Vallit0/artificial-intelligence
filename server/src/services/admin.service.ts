// ============================================
// Admin Service
// ============================================

import prisma from '../db/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/passwordHash.js';
import { AuthUser, AppRole } from '../types/index.js';
import { canCreateCoachIn, isGlobalAdmin, getSedeScope } from '../middleware/sedeScope.js';

// Roles que se pueden crear desde el panel admin. `admin` se trata aparte
// para retrocompatibilidad con el flag `isAdmin` legacy.
const CREATABLE_ROLES: AppRole[] = ['learner', 'coach', 'instructor'];

interface CreateUserInput {
  email: string;
  password: string;
  sedeId?: string;            // UUID o slug — el servicio lo resuelve
  sede?: string;              // alias para sedeId, conveniente desde la UI
  role?: AppRole;             // 'learner' | 'coach' | 'instructor' (default 'learner')
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isAdmin?: boolean;          // legacy — equivale a role=admin
}

interface StudentWithStats {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  totalSessions: number;
  totalDuration: number;
  averageScore: number | null;
  bestExamScore: number | null;
  examAttempts: number;
  finalGrade: number | null;
  gradedBy: string | null;
  gradeNotes: string | null;
  examenFinalEnabled: boolean;
  phoneNumber: string | null;
  sedeId: string | null;
  sedeName: string | null;
  coachId: string | null;
  coachName: string | null;
}

// ============================================
// User Management
// ============================================

export async function createUser(input: CreateUserInput, caller: AuthUser) {
  const email = input.email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    throw new BadRequestError('Formato de email inválido');
  }
  if (!input.password || input.password.length < 12) {
    throw new BadRequestError('La contraseña debe tener al menos 12 caracteres');
  }

  // Resolver sede (UUID o slug). Obligatorio para todo user nuevo.
  const sedeRef = input.sedeId ?? input.sede;
  if (!sedeRef) {
    throw new BadRequestError('sedeId es requerido');
  }
  const sede = await prisma.sede.findFirst({
    where: { isActive: true, OR: [{ id: sedeRef }, { slug: sedeRef }] },
    select: { id: true },
  });
  if (!sede) {
    throw new BadRequestError('Sede inválida o inactiva');
  }

  // Resolver rol target. `isAdmin` legacy se mapea a `admin`.
  let targetRole: AppRole;
  if (input.isAdmin) {
    targetRole = 'admin';
  } else if (input.role) {
    if (!CREATABLE_ROLES.includes(input.role) && input.role !== 'admin') {
      throw new BadRequestError(`Rol inválido: ${input.role}`);
    }
    targetRole = input.role;
  } else {
    targetRole = 'learner';
  }

  // Autorización: quién puede crear qué.
  //  - admin global: cualquier rol en cualquier sede
  //  - coach con canCreateCoaches: sólo rol coach en su propia sede
  //  - resto: prohibido
  if (!isGlobalAdmin(caller)) {
    if (targetRole !== 'coach') {
      throw new ForbiddenError('Sólo admin global puede crear este rol');
    }
    if (!canCreateCoachIn(caller, sede.id)) {
      throw new ForbiddenError('No tenés permiso para crear coaches en esta sede');
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Este email ya está registrado');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phoneNumber: input.phoneNumber?.trim() || null,
      emailVerified: true,
      sedeId: sede.id,
      roles: {
        create: { role: targetRole },
      },
    },
  });

  // Convención existente: admin también obtiene learner para que vea su propia
  // vista de práctica. La mantenemos por retrocompat.
  if (targetRole === 'admin') {
    await prisma.userRole.create({
      data: { userId: user.id, role: 'learner' },
    }).catch(() => {}); // ignore if already exists
  }

  // Si el rol es coach, creamos la fila de permisos en false por defecto.
  // Un admin la editará desde el panel para otorgar canCreateCoaches /
  // canEditPrompts según corresponda.
  if (targetRole === 'coach') {
    await prisma.coachPermission.create({
      data: {
        userId: user.id,
        canCreateCoaches: false,
        canEditPrompts: false,
        grantedBy: caller.id,
      },
    });
  }

  return { id: user.id, email: user.email, role: targetRole, sedeId: sede.id };
}

// Bulk create — el caller pasa un sedeId común a todo el lote (la UI hace
// una creación masiva por sede), o cada item puede traer su propio sedeId.
// Sólo admin global puede hacer bulk; coaches no porque por diseño la UI
// de coaches crea uno por vez con permisos canCreateCoaches.
export async function bulkCreateUsers(users: CreateUserInput[], caller: AuthUser, defaultSedeRef?: string) {
  if (!isGlobalAdmin(caller)) {
    throw new ForbiddenError('Sólo admin global puede hacer creación masiva');
  }
  if (!users || !Array.isArray(users) || users.length === 0) {
    throw new BadRequestError('Se requiere un array de usuarios');
  }
  if (users.length > 100) {
    throw new BadRequestError('Máximo 100 usuarios por lote');
  }

  // Pre-resolver todas las sedes referenciadas para no consultarlas 1 por
  // user. Construimos un mapa ref→id válido (sólo sedes activas).
  const refsNeeded = new Set<string>();
  if (defaultSedeRef) refsNeeded.add(defaultSedeRef);
  for (const u of users) {
    const ref = u.sedeId ?? u.sede;
    if (ref) refsNeeded.add(ref);
  }
  const sedes = refsNeeded.size
    ? await prisma.sede.findMany({
        where: {
          isActive: true,
          OR: [
            { id: { in: Array.from(refsNeeded) } },
            { slug: { in: Array.from(refsNeeded) } },
          ],
        },
        select: { id: true, slug: true },
      })
    : [];
  const sedeIdByRef = new Map<string, string>();
  for (const s of sedes) {
    sedeIdByRef.set(s.id, s.id);
    sedeIdByRef.set(s.slug, s.id);
  }

  const existingUsers = await prisma.user.findMany({
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  // Procesamos en chunks paralelos. bcrypt es CPU-bound (~60ms con rounds=10),
  // así que chunkear evita bloquear el event loop completo. CHUNK_SIZE=5
  // mantiene el throughput sin saturar el pool de Prisma.
  const CHUNK_SIZE = 5;
  const results: { email: string; success: boolean; error?: string }[] = new Array(users.length);

  const processOne = async (userData: CreateUserInput) => {
    const email = userData.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return { email: email || 'desconocido', success: false, error: 'Email inválido' };
    }
    if (!userData.password || userData.password.length < 12) {
      return { email, success: false, error: 'Contraseña debe tener al menos 12 caracteres' };
    }
    if (existingEmails.has(email)) {
      return { email, success: false, error: 'Usuario ya existe' };
    }
    const ref = userData.sedeId ?? userData.sede ?? defaultSedeRef;
    if (!ref) {
      return { email, success: false, error: 'sedeId requerido' };
    }
    const resolvedSedeId = sedeIdByRef.get(ref);
    if (!resolvedSedeId) {
      return { email, success: false, error: 'Sede inválida o inactiva' };
    }

    try {
      const passwordHash = await hashPassword(userData.password);
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: userData.firstName?.trim() || null,
          lastName: userData.lastName?.trim() || null,
          emailVerified: true,
          sedeId: resolvedSedeId,
          roles: { create: { role: 'learner' } },
        },
      });
      return { email, success: true };
    } catch (err: any) {
      // P2002 = unique constraint. Pasa cuando dos emails iguales viajan en
      // el mismo chunk: el pre-check con existingEmails sólo detecta dups
      // contra la DB, no entre filas del lote.
      if (err?.code === 'P2002') {
        return { email, success: false, error: 'Usuario ya existe' };
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      return { email, success: false, error: message };
    }
  };

  for (let start = 0; start < users.length; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, users.length);
    const chunkResults = await Promise.all(users.slice(start, end).map(processOne));
    for (let j = 0; j < chunkResults.length; j++) {
      results[start + j] = chunkResults[j];
      if (chunkResults[j].success) existingEmails.add(chunkResults[j].email);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

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

// Verifica que el caller tenga acceso a `userId` según su scope. Para admin
// global pasa siempre; para coach valida que el target sea de su misma
// sede. Pasa filterByRoles para que el listado de "estudiantes" del coach
// no incluya otros coaches/instructores de su sede por accidente.
async function loadUserScopedOrThrow(userId: string, caller: AuthUser): Promise<{ id: string; sedeId: string | null }> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, sedeId: true },
  });
  if (!target) {
    throw new NotFoundError('Usuario no encontrado');
  }
  if (!isGlobalAdmin(caller)) {
    if (!target.sedeId || target.sedeId !== caller.sedeId) {
      // 404 en lugar de 403 para no filtrar existencia entre sedes.
      throw new NotFoundError('Usuario no encontrado');
    }
  }
  return target;
}

export async function updateUserPassword(userId: string, newPassword: string, caller: AuthUser) {
  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
  }

  await loadUserScopedOrThrow(userId, caller);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true };
}

// ============================================
// Student Management
// ============================================

export async function getAllStudents(caller: AuthUser): Promise<StudentWithStats[]> {
  // Coach/instructor ven sólo learners de su sede. Admin global ve todos
  // los learners (o todos los users si pasa override — no implementado acá
  // todavía; el override por ?sedeId= se aplicaría en el route).
  const scope = getSedeScope(caller);
  const sedeFilter = scope.scope === 'sede' ? { sedeId: scope.sedeId } : {};

  const users = await prisma.user.findMany({
    where: {
      ...sedeFilter,
      // Listado de "estudiantes" — sólo learners. Si más adelante se quiere
      // un panel separado de "coaches" del admin, agregamos otra función.
      roles: { some: { role: 'learner' } },
    },
    include: {
      practiceSessions: {
        select: { durationSeconds: true, score: true, scenarioId: true },
      },
      studentGrade: {
        select: { finalGrade: true, gradedBy: true, notes: true },
      },
      coach: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      sede: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map(user => {
    const sessions = user.practiceSessions;
    const scores = sessions.map(s => s.score).filter((s): s is number => s !== null);
    const examScores = sessions
      .filter(s => s.scenarioId === null && s.score !== null)
      .map(s => s.score as number);
    const examAttempts = sessions.filter(s => s.scenarioId === null).length;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      totalSessions: sessions.length,
      totalDuration: sessions.reduce((acc, s) => acc + s.durationSeconds, 0),
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      bestExamScore: examScores.length > 0 ? Math.max(...examScores) : null,
      examAttempts,
      finalGrade: user.studentGrade ? Number(user.studentGrade.finalGrade) : null,
      gradedBy: user.studentGrade?.gradedBy || null,
      gradeNotes: user.studentGrade?.notes || null,
      examenFinalEnabled: user.examenFinalEnabled,
      level2Unlocked: user.level2Unlocked,
      phoneNumber: user.phoneNumber,
      sedeId: user.sedeId,
      sedeName: user.sede?.name ?? null,
      coachId: user.coachId,
      coachName: user.coach
        ? [user.coach.firstName, user.coach.lastName].filter(Boolean).join(' ') || user.coach.email
        : null,
    };
  });
}

// ============================================
// Asignación de coach (admin global only)
// ============================================
// Asigna (o desasigna con coachId=null) el coach de un learner. El coach debe
// tener rol coach y pertenecer a la MISMA sede que el learner — refuerza el
// aislamiento duro entre sedes. Sólo admin global puede invocarla.
export async function assignCoach(learnerId: string, coachId: string | null, caller: AuthUser) {
  if (!isGlobalAdmin(caller)) {
    throw new ForbiddenError('Sólo admin global puede asignar coaches');
  }

  const learner = await prisma.user.findUnique({
    where: { id: learnerId },
    select: { id: true, sedeId: true },
  });
  if (!learner) {
    throw new NotFoundError('Usuario no encontrado');
  }

  if (coachId !== null) {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { id: true, sedeId: true, roles: { select: { role: true } } },
    });
    if (!coach || !coach.roles.some((r) => r.role === 'coach')) {
      throw new BadRequestError('El coach indicado no existe o no tiene rol coach');
    }
    if (!learner.sedeId || coach.sedeId !== learner.sedeId) {
      throw new BadRequestError('El coach debe pertenecer a la misma sede que el estudiante');
    }
  }

  const updated = await prisma.user.update({
    where: { id: learnerId },
    data: { coachId },
    select: {
      id: true,
      coach: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return {
    id: updated.id,
    coachId: updated.coach?.id ?? null,
    coachName: updated.coach
      ? [updated.coach.firstName, updated.coach.lastName].filter(Boolean).join(' ') || updated.coach.email
      : null,
  };
}

export async function toggleExamenFinal(userId: string, enabled: boolean, caller: AuthUser) {
  await loadUserScopedOrThrow(userId, caller);

  return prisma.user.update({
    where: { id: userId },
    data: { examenFinalEnabled: enabled },
    select: { id: true, examenFinalEnabled: true },
  });
}

export async function bulkToggleExamenFinal(userIds: string[], enabled: boolean, caller: AuthUser) {
  // Filtramos a sólo IDs dentro del scope del caller. Si un ID del lote
  // pertenece a otra sede, se ignora silenciosamente (count será menor).
  const scope = getSedeScope(caller);
  const where: any = { id: { in: userIds } };
  if (scope.scope === 'sede') {
    where.sedeId = scope.sedeId;
  }

  const result = await prisma.user.updateMany({
    where,
    data: { examenFinalEnabled: enabled },
  });
  return { count: result.count, enabled };
}

export async function upsertGrade(userId: string, gradedBy: string, finalGrade: number, caller: AuthUser, notes?: string) {
  if (finalGrade < 0 || finalGrade > 100) {
    throw new BadRequestError('La calificación debe estar entre 0 y 100');
  }
  await loadUserScopedOrThrow(userId, caller);

  return prisma.studentGrade.upsert({
    where: { userId },
    create: { userId, gradedBy, finalGrade, notes: notes || null },
    update: { gradedBy, finalGrade, notes: notes || null },
  });
}

export async function updateUserName(userId: string, caller: AuthUser, firstName?: string, lastName?: string) {
  await loadUserScopedOrThrow(userId, caller);

  return prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
    },
    select: { id: true, firstName: true, lastName: true },
  });
}

// ============================================
// Helpers
// ============================================

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
