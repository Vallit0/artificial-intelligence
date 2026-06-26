// ============================================
// Divisions Service
// ============================================
//
// CRUD de divisiones + asignación de estudiantes a divisiones. Una Sede
// tiene varias Divisiones y cada División tiene UN coach a cargo. Los
// estudiantes se asignan a una División y heredan su coach: `User.coachId`
// se mantiene denormalizado/sincronizado desde el coach de la división
// para no romper el código existente (calificaciones, sidebar, /auth/me).
//
// El scope respeta el aislamiento por sede: admin global ve/crea en todas
// las sedes; un coach scoped sólo opera dentro de la suya. Los routes
// aplican requireGlobalAdmin, pero validamos el scope acá igualmente como
// defensa en profundidad.

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { getSedeScope, assertSedeAccess } from '../middleware/sedeScope.js';

const divisionInclude = {
  sede: { select: { id: true, slug: true, name: true } },
  coach: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { learners: true } },
} as const;

function shapeDivision(d: {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  sede: { id: string; slug: string; name: string } | null;
  coach: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  _count: { learners: number };
}) {
  return {
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    createdAt: d.createdAt,
    sede: d.sede,
    coach: d.coach
      ? {
          id: d.coach.id,
          name: [d.coach.firstName, d.coach.lastName].filter(Boolean).join(' ') || d.coach.email,
          email: d.coach.email,
        }
      : null,
    learnerCount: d._count.learners,
  };
}

export interface CreateDivisionInput {
  sedeId: string;
  name: string;
  coachId?: string | null;
}

export interface UpdateDivisionInput {
  name?: string;
  isActive?: boolean;
  coachId?: string | null;
}

// Verifica que `coachId` referencia a un usuario con rol coach de `sedeId`.
// Lanza BadRequestError si no. Devuelve void.
async function assertCoachOfSede(coachId: string, sedeId: string) {
  const coach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { id: true, sedeId: true, roles: { select: { role: true } } },
  });
  if (!coach || !coach.roles.some((r) => r.role === 'coach')) {
    throw new BadRequestError('El coach indicado no existe o no tiene rol coach');
  }
  if (coach.sedeId !== sedeId) {
    throw new BadRequestError('El coach debe pertenecer a la misma sede que la división');
  }
}

export async function listDivisions(caller: AuthUser, opts?: { includeInactive?: boolean }) {
  const scope = getSedeScope(caller);
  const where: any = {};
  if (scope.scope === 'sede') where.sedeId = scope.sedeId;
  if (!opts?.includeInactive) where.isActive = true;

  const divisions = await prisma.division.findMany({
    where,
    include: divisionInclude,
    orderBy: [{ sedeId: 'asc' }, { name: 'asc' }],
  });
  return divisions.map(shapeDivision);
}

export async function createDivision(input: CreateDivisionInput, caller: AuthUser) {
  if (!input.name?.trim()) {
    throw new BadRequestError('Nombre de división requerido');
  }
  const sede = await prisma.sede.findUnique({ where: { id: input.sedeId }, select: { id: true } });
  if (!sede) throw new BadRequestError('Sede inválida');
  assertSedeAccess(caller, input.sedeId);

  if (input.coachId) {
    await assertCoachOfSede(input.coachId, input.sedeId);
  }

  const name = input.name.trim();
  const collision = await prisma.division.findUnique({
    where: { sedeId_name: { sedeId: input.sedeId, name } },
    select: { id: true },
  });
  if (collision) throw new ConflictError('Ya existe una división con ese nombre en la sede');

  const created = await prisma.division.create({
    data: { sedeId: input.sedeId, name, coachId: input.coachId ?? null },
    include: divisionInclude,
  });
  return shapeDivision(created);
}

export async function updateDivision(id: string, input: UpdateDivisionInput, caller: AuthUser) {
  const existing = await prisma.division.findUnique({
    where: { id },
    select: { id: true, sedeId: true, name: true, coachId: true },
  });
  if (!existing) throw new NotFoundError('División no encontrada');
  assertSedeAccess(caller, existing.sedeId);

  if (input.name !== undefined && input.name.trim() !== existing.name) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError('Nombre de división requerido');
    const collision = await prisma.division.findUnique({
      where: { sedeId_name: { sedeId: existing.sedeId, name } },
      select: { id: true },
    });
    if (collision) throw new ConflictError('Ya existe una división con ese nombre en la sede');
  }

  // Cambio de coach: validar y re-sincronizar coachId de los learners.
  const coachChanged = input.coachId !== undefined && input.coachId !== existing.coachId;
  if (coachChanged && input.coachId) {
    await assertCoachOfSede(input.coachId, existing.sedeId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const div = await tx.division.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
        coachId: input.coachId !== undefined ? input.coachId : undefined,
      },
      include: divisionInclude,
    });
    if (coachChanged) {
      // Re-sincroniza el coach denormalizado de todos los learners de la división.
      await tx.user.updateMany({
        where: { divisionId: id },
        data: { coachId: input.coachId ?? null },
      });
    }
    return div;
  });

  return shapeDivision(updated);
}

export async function deleteDivision(id: string, caller: AuthUser) {
  const existing = await prisma.division.findUnique({
    where: { id },
    select: { id: true, sedeId: true },
  });
  if (!existing) throw new NotFoundError('División no encontrada');
  assertSedeAccess(caller, existing.sedeId);

  const learnerCount = await prisma.user.count({ where: { divisionId: id } });
  if (learnerCount > 0) {
    throw new ConflictError(
      `No se puede eliminar la división: tiene ${learnerCount} estudiante(s) asignado(s). Reasignalos o desactivá la división.`,
    );
  }
  await prisma.division.delete({ where: { id } });
  return { success: true };
}

// Asigna (o desasigna con divisionId=null) la división de un estudiante y
// sincroniza su coach denormalizado con el coach de la división. La división
// debe pertenecer a la MISMA sede que el estudiante — refuerza el aislamiento.
export async function assignLearnerToDivision(
  learnerId: string,
  divisionId: string | null,
  caller: AuthUser,
) {
  const learner = await prisma.user.findUnique({
    where: { id: learnerId },
    select: { id: true, sedeId: true },
  });
  if (!learner) throw new NotFoundError('Usuario no encontrado');
  assertSedeAccess(caller, learner.sedeId);

  let coachId: string | null = null;
  if (divisionId !== null) {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, sedeId: true, coachId: true },
    });
    if (!division) throw new BadRequestError('La división indicada no existe');
    if (!learner.sedeId || division.sedeId !== learner.sedeId) {
      throw new BadRequestError('La división debe pertenecer a la misma sede que el estudiante');
    }
    coachId = division.coachId;
  }

  const updated = await prisma.user.update({
    where: { id: learnerId },
    data: { divisionId, coachId },
    select: {
      id: true,
      division: { select: { id: true, name: true } },
      coach: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return {
    id: updated.id,
    divisionId: updated.division?.id ?? null,
    divisionName: updated.division?.name ?? null,
    coachId: updated.coach?.id ?? null,
    coachName: updated.coach
      ? [updated.coach.firstName, updated.coach.lastName].filter(Boolean).join(' ') || updated.coach.email
      : null,
  };
}

// Listado PÚBLICO de divisiones activas de una sede, para el selector del
// formulario de auto-registro (el usuario aún no tiene sesión). Acepta la
// sede como UUID o slug y expone sólo { id, name }.
export async function listPublicDivisionsBySede(sedeRef: string) {
  if (!sedeRef || typeof sedeRef !== 'string') {
    throw new BadRequestError('sedeId es requerido');
  }
  const sede = await prisma.sede.findFirst({
    where: { isActive: true, OR: [{ id: sedeRef }, { slug: sedeRef }] },
    select: { id: true },
  });
  if (!sede) throw new BadRequestError('Sede inválida o inactiva');

  const divisions = await prisma.division.findMany({
    where: { sedeId: sede.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return divisions.map((d) => ({ id: d.id, name: d.name }));
}
