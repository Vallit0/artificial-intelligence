// ============================================
// Admin Service
// ============================================

import { Prisma } from '@prisma/client';
import prisma from '../db/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/passwordHash.js';
import { DateRange, createdAtWhere } from '../utils/dateRange.js';
import { AuthUser, AppRole } from '../types/index.js';
import { canCreateCoachIn, isGlobalAdmin, getSedeScope } from '../middleware/sedeScope.js';

// Todos los roles asignables vía edición de usuario (incluye admin, a
// diferencia de CREATABLE_ROLES que es para creación masiva sin admin).
const ASSIGNABLE_ROLES: AppRole[] = ['learner', 'coach', 'instructor', 'admin'];

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
  examenObjecionesEnabled: boolean;
  phoneNumber: string | null;
  sedeId: string | null;
  sedeName: string | null;
  sedeCountry: string | null;
  coachId: string | null;
  coachName: string | null;
  divisionId: string | null;
  divisionName: string | null;
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
      // Los usuarios creados desde el panel admin se aprueban en el acto — el
      // flujo de aprobación pending sólo aplica al auto-registro público.
      status: 'approved',
      approvedBy: caller.id,
      approvedAt: new Date(),
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
          // Bulk lo hace admin global → aprobados en el acto (ver createUser).
          status: 'approved',
          approvedBy: caller.id,
          approvedAt: new Date(),
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

export async function getAllStudents(caller: AuthUser, range?: DateRange): Promise<StudentWithStats[]> {
  // Coach/instructor ven sólo learners de su sede. Admin global ve todos
  // los learners (o todos los users si pasa override — no implementado acá
  // todavía; el override por ?sedeId= se aplicaría en el route).
  const scope = getSedeScope(caller);
  const sedeFilter = scope.scope === 'sede' ? { sedeId: scope.sedeId } : {};
  // Filtro de período OPCIONAL: cuando viene, las métricas derivadas de sesiones
  // (sesiones, tiempo, promedios, intentos de examen) se acotan al rango. La
  // nota final (studentGrade) no depende de fecha y queda intacta.
  const sessionDateWhere = createdAtWhere(range);

  const users = await prisma.user.findMany({
    where: {
      ...sedeFilter,
      // Listado de "estudiantes" — sólo learners. Si más adelante se quiere
      // un panel separado de "coaches" del admin, agregamos otra función.
      roles: { some: { role: 'learner' } },
      // Los usuarios pendientes/rechazados de auto-registro viven en la bandeja
      // de aprobación, no acá — el panel de estudiantes es sólo aprobados.
      status: 'approved',
    },
    include: {
      practiceSessions: {
        where: sessionDateWhere,
        select: { durationSeconds: true, score: true, scenarioId: true },
      },
      studentGrade: {
        select: { finalGrade: true, gradedBy: true, notes: true },
      },
      coach: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      sede: {
        select: { id: true, name: true, country: true },
      },
      division: {
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
      examenObjecionesEnabled: user.examenObjecionesEnabled,
      level2Unlocked: user.level2Unlocked,
      phoneNumber: user.phoneNumber,
      sedeId: user.sedeId,
      sedeName: user.sede?.name ?? null,
      sedeCountry: user.sede?.country ?? null,
      coachId: user.coachId,
      coachName: user.coach
        ? [user.coach.firstName, user.coach.lastName].filter(Boolean).join(' ') || user.coach.email
        : null,
      divisionId: user.divisionId,
      divisionName: user.division?.name ?? null,
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

// ============================================
// Habilitar / deshabilitar exámenes (admin global o coach)
// ============================================
// Hay DOS exámenes finales, cada uno con su flag gate en User:
//   - 'prospeccion' (Nivel 1) → examenFinalEnabled
//   - 'objeciones'  (Nivel 2) → examenObjecionesEnabled
// Alcance: el admin global puede habilitar a cualquier estudiante; un coach
// SÓLO a sus estudiantes asignados (user.coachId === coach.id), no a toda la
// sede. La ruta ya está gateada a requireRole('admin','coach').
export type ExamKind = 'prospeccion' | 'objeciones';

const EXAM_COLUMN: Record<ExamKind, 'examenFinalEnabled' | 'examenObjecionesEnabled'> = {
  prospeccion: 'examenFinalEnabled',
  objeciones: 'examenObjecionesEnabled',
};

// Valida que el caller puede togglear el examen del target. Devuelve void.
// Usa 404 (no 403) para no filtrar existencia entre sedes/coaches.
function assertExamToggleAccess(target: { coachId: string | null }, caller: AuthUser) {
  if (isGlobalAdmin(caller)) return;
  // No admin global: sólo coach, y sólo sobre sus estudiantes asignados.
  if (caller.roles.includes('coach') && target.coachId === caller.id) return;
  throw new NotFoundError('Usuario no encontrado');
}

export async function toggleExamen(
  userId: string,
  exam: ExamKind,
  enabled: boolean,
  caller: AuthUser,
) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, coachId: true },
  });
  if (!target) throw new NotFoundError('Usuario no encontrado');
  assertExamToggleAccess(target, caller);

  const column = EXAM_COLUMN[exam];
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { [column]: enabled },
    select: { id: true, examenFinalEnabled: true, examenObjecionesEnabled: true },
  });
  return { exam, enabled, ...updated };
}

export async function bulkToggleExamen(
  userIds: string[],
  exam: ExamKind,
  enabled: boolean,
  caller: AuthUser,
) {
  // Filtramos a sólo IDs dentro del alcance del caller. Admin global: todos.
  // Coach: sólo sus asignados. IDs fuera de alcance se ignoran (count menor).
  const where: any = { id: { in: userIds } };
  if (!isGlobalAdmin(caller)) {
    if (caller.roles.includes('coach')) {
      where.coachId = caller.id;
    } else {
      const scope = getSedeScope(caller);
      if (scope.scope === 'sede') where.sedeId = scope.sedeId;
    }
  }

  const column = EXAM_COLUMN[exam];
  const result = await prisma.user.updateMany({ where, data: { [column]: enabled } });
  return { count: result.count, enabled, exam };
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
// Edición unificada de usuario (admin global only)
// ============================================

export interface UpdateUserInput {
  sedeId?: string;            // UUID o slug — sólo presente si se mueve de sede
  roles?: AppRole[];          // reescribe el set completo de roles
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  coachId?: string | null;    // legacy: asignación directa de coach. Si se pasa
                              // divisionId, éste manda y sincroniza coachId.
  divisionId?: string | null; // división del estudiante; sincroniza coachId con
                              // el coach de la división. Decisión requerida al
                              // cambiar de sede.
  examenFinalEnabled?: boolean;
  examenObjecionesEnabled?: boolean;
  level2Unlocked?: boolean;
  courseCompleted?: boolean;
  tutorialCompleted?: boolean;
  emailVerified?: boolean;
}

// Devuelve el estado editable completo de un usuario (incluye roles y flags
// que el listado de estudiantes no trae). Alimenta el modal "Editar usuario".
// Sólo admin global.
export async function getEditableUser(userId: string, caller: AuthUser) {
  if (!isGlobalAdmin(caller)) {
    throw new ForbiddenError('Sólo admin global puede ver el detalle editable');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sede: { select: { id: true, name: true } },
      coach: { select: { id: true, firstName: true, lastName: true, email: true } },
      division: { select: { id: true, name: true } },
      roles: { select: { role: true } },
    },
  });
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    status: user.status,
    sedeId: user.sedeId,
    sedeName: user.sede?.name ?? null,
    coachId: user.coachId,
    coachName: user.coach
      ? [user.coach.firstName, user.coach.lastName].filter(Boolean).join(' ') || user.coach.email
      : null,
    divisionId: user.divisionId,
    divisionName: user.division?.name ?? null,
    roles: user.roles.map((r) => r.role),
    examenFinalEnabled: user.examenFinalEnabled,
    examenObjecionesEnabled: user.examenObjecionesEnabled,
    level2Unlocked: user.level2Unlocked,
    courseCompleted: user.courseCompleted,
    tutorialCompleted: user.tutorialCompleted,
    emailVerified: user.emailVerified,
  };
}

// Edita cualquier subconjunto de campos de un usuario. Sólo admin global.
// Concentra las reglas delicadas: mover de sede invalida el coach anterior
// (hay que indicar uno nuevo de la sede destino, o null), reescribir roles
// se hace transaccional, y cambiar el email invalida las sesiones activas.
export async function updateUser(userId: string, input: UpdateUserInput, caller: AuthUser) {
  if (!isGlobalAdmin(caller)) {
    throw new ForbiddenError('Sólo admin global puede editar usuarios');
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      sedeId: true,
      coachId: true,
      divisionId: true,
      roles: { select: { role: true } },
    },
  });
  if (!target) {
    throw new NotFoundError('Usuario no encontrado');
  }

  const data: Prisma.UserUncheckedUpdateInput = {};

  // --- Sede ---
  let newSedeId = target.sedeId;
  if (input.sedeId !== undefined) {
    const sede = await prisma.sede.findFirst({
      where: { isActive: true, OR: [{ id: input.sedeId }, { slug: input.sedeId }] },
      select: { id: true },
    });
    if (!sede) {
      throw new BadRequestError('Sede inválida o inactiva');
    }
    newSedeId = sede.id;
    data.sedeId = sede.id;
  }
  const sedeChanged = newSedeId !== target.sedeId;

  if (sedeChanged) {
    // Si el usuario es coach con alumnos asignados, moverlo de sede dejaría a
    // esos alumnos con un coach de otra sede (rompe el aislamiento). Bloquear
    // hasta que se reasignen.
    const learnerCount = await prisma.user.count({ where: { coachId: userId } });
    if (learnerCount > 0) {
      throw new BadRequestError(
        'Este usuario es coach con alumnos asignados. Reasigná sus alumnos antes de cambiarlo de sede.',
      );
    }
    // La división/coach previos son de la sede vieja → ya no son válidos.
    // Exigir decisión explícita: una división de la sede destino, o null.
    if (input.divisionId === undefined && input.coachId === undefined) {
      throw new BadRequestError('Al cambiar de sede debés indicar la división de la sede destino (o null).');
    }
  }

  // --- División (fuente de verdad; sincroniza coachId) ---
  // Tiene precedencia sobre `coachId`: si se pasa divisionId, el coach se deriva
  // del coach de la división. `coachId` directo se mantiene sólo para callers
  // legacy que no pasan divisionId.
  if (input.divisionId !== undefined) {
    if (input.divisionId === null) {
      data.divisionId = null;
      data.coachId = null;
    } else {
      const division = await prisma.division.findUnique({
        where: { id: input.divisionId },
        select: { id: true, sedeId: true, coachId: true },
      });
      if (!division || division.sedeId !== newSedeId) {
        throw new BadRequestError('La división debe pertenecer a la sede del usuario');
      }
      data.divisionId = division.id;
      data.coachId = division.coachId;
    }
  } else if (input.coachId !== undefined) {
    if (input.coachId === null) {
      data.coachId = null;
    } else {
      const coach = await prisma.user.findUnique({
        where: { id: input.coachId },
        select: { id: true, sedeId: true, status: true, roles: { select: { role: true } } },
      });
      if (
        !coach ||
        coach.status !== 'approved' ||
        !coach.roles.some((r) => r.role === 'coach') ||
        coach.sedeId !== newSedeId
      ) {
        throw new BadRequestError('El coach debe tener rol coach y pertenecer a la sede del usuario');
      }
      data.coachId = coach.id;
    }
  } else if (sedeChanged) {
    // Defensa extra: nunca dejar una división/coach de la sede vieja tras mover.
    data.divisionId = null;
    data.coachId = null;
  }

  // --- Email ---
  let emailChanged = false;
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw new BadRequestError('Formato de email inválido');
    }
    if (email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictError('Este email ya está registrado');
      }
      data.email = email;
      emailChanged = true;
    }
  }

  // --- Campos simples / flags ---
  if (input.firstName !== undefined) data.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) data.lastName = input.lastName?.trim() || null;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber?.trim() || null;
  if (input.examenFinalEnabled !== undefined) data.examenFinalEnabled = input.examenFinalEnabled;
  if (input.examenObjecionesEnabled !== undefined) data.examenObjecionesEnabled = input.examenObjecionesEnabled;
  if (input.level2Unlocked !== undefined) data.level2Unlocked = input.level2Unlocked;
  if (input.courseCompleted !== undefined) data.courseCompleted = input.courseCompleted;
  if (input.tutorialCompleted !== undefined) data.tutorialCompleted = input.tutorialCompleted;
  if (input.emailVerified !== undefined) data.emailVerified = input.emailVerified;

  // --- Roles ---
  let rolesToSet: AppRole[] | undefined;
  if (input.roles !== undefined) {
    const roles = Array.from(new Set(input.roles));
    if (roles.length === 0) {
      throw new BadRequestError('El usuario debe tener al menos un rol');
    }
    for (const r of roles) {
      if (!ASSIGNABLE_ROLES.includes(r)) {
        throw new BadRequestError(`Rol inválido: ${r}`);
      }
    }
    // Guardrail: un admin no puede quitarse a sí mismo su propio rol admin
    // (evita quedarse sin acceso global por error).
    const targetRoles = target.roles.map((r) => r.role as AppRole);
    if (userId === caller.id && targetRoles.includes('admin') && !roles.includes('admin')) {
      throw new BadRequestError('No podés quitarte tu propio rol admin');
    }
    rolesToSet = roles;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: userId }, data });
    }

    if (rolesToSet) {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({ data: rolesToSet.map((role) => ({ userId, role })) });
      // Si ahora es coach, asegurar su fila de permisos (en false por defecto).
      if (rolesToSet.includes('coach')) {
        await tx.coachPermission.upsert({
          where: { userId },
          create: { userId, canCreateCoaches: false, canEditPrompts: false, grantedBy: caller.id },
          update: {},
        });
      }
    }

    // Cambiar el email invalida las sesiones existentes por seguridad.
    if (emailChanged) {
      await tx.refreshToken.deleteMany({ where: { userId } });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sede: { select: { id: true, name: true } },
      coach: { select: { id: true, firstName: true, lastName: true, email: true } },
      roles: { select: { role: true } },
    },
  });

  return {
    id: updated!.id,
    email: updated!.email,
    firstName: updated!.firstName,
    lastName: updated!.lastName,
    phoneNumber: updated!.phoneNumber,
    status: updated!.status,
    sedeId: updated!.sedeId,
    sedeName: updated!.sede?.name ?? null,
    coachId: updated!.coachId,
    coachName: updated!.coach
      ? [updated!.coach.firstName, updated!.coach.lastName].filter(Boolean).join(' ') || updated!.coach.email
      : null,
    roles: updated!.roles.map((r) => r.role),
    emailChanged,
  };
}

// ============================================
// Auto-registro: bandeja de aprobación
// ============================================

// Lista los usuarios en estado `pending` esperando visto bueno. Scope-aware:
// admin global ve todas las sedes; un coach ve sólo los pendientes de su sede.
export async function listPendingUsers(caller: AuthUser) {
  const scope = getSedeScope(caller);
  const sedeFilter = scope.scope === 'sede' ? { sedeId: scope.sedeId } : {};

  const users = await prisma.user.findMany({
    where: { ...sedeFilter, status: 'pending' },
    include: {
      sede: { select: { id: true, name: true } },
      coach: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phoneNumber: u.phoneNumber,
    createdAt: u.createdAt,
    sedeId: u.sedeId,
    sedeName: u.sede?.name ?? null,
    coachId: u.coachId,
    coachName: u.coach
      ? [u.coach.firstName, u.coach.lastName].filter(Boolean).join(' ') || u.coach.email
      : null,
  }));
}

export interface ApprovalResult {
  id: string;
  email: string;
  status: 'approved' | 'rejected';
}

// Aprueba o rechaza un registro pendiente. Accesible a admin global o al
// coach/instructor de la sede del usuario (el scope se valida con
// loadUserScopedOrThrow → 404 cross-sede). Sólo opera sobre usuarios que
// siguen en `pending`; reintentar sobre uno ya resuelto es un 400.
export async function setUserApproval(
  userId: string,
  decision: 'approve' | 'reject',
  caller: AuthUser,
  reason?: string,
): Promise<ApprovalResult> {
  await loadUserScopedOrThrow(userId, caller);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true },
  });
  if (!target) {
    throw new NotFoundError('Usuario no encontrado');
  }
  if (target.status !== 'pending') {
    throw new BadRequestError('Este usuario ya fue procesado');
  }

  const newStatus = decision === 'approve' ? 'approved' : 'rejected';
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: newStatus,
      approvedBy: caller.id,
      approvedAt: new Date(),
      rejectedReason: decision === 'reject' ? (reason?.trim() || null) : null,
    },
  });

  return { id: target.id, email: target.email, status: newStatus };
}

// ============================================
// Helpers
// ============================================

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
