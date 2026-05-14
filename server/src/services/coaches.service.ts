// ============================================
// Coaches Service
// ============================================
//
// Listado y gestión de permisos de coaches. El listado lo invoca admin
// global (ve todas las sedes) o un coach con canCreateCoaches (ve sólo
// los de su sede, para gestionar/onboardear). Los toggles de permisos
// son admin-global only — un coach con canCreateCoaches no puede otorgar
// canCreateCoaches a otro coach.

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { getSedeScope, isGlobalAdmin } from '../middleware/sedeScope.js';

export async function listCoaches(caller: AuthUser) {
  const scope = getSedeScope(caller);
  const where: any = {
    roles: { some: { role: 'coach' } },
  };
  if (scope.scope === 'sede') {
    where.sedeId = scope.sedeId;
  }
  const coaches = await prisma.user.findMany({
    where,
    include: {
      sede: { select: { id: true, slug: true, name: true } },
      coachPermissions: {
        select: { canCreateCoaches: true, canEditPrompts: true, grantedBy: true, updatedAt: true },
      },
    },
    orderBy: [{ sedeId: 'asc' }, { firstName: 'asc' }],
  });

  return coaches.map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    sede: c.sede,
    createdAt: c.createdAt,
    permissions: {
      canCreateCoaches: c.coachPermissions?.canCreateCoaches ?? false,
      canEditPrompts: c.coachPermissions?.canEditPrompts ?? false,
      grantedBy: c.coachPermissions?.grantedBy ?? null,
      updatedAt: c.coachPermissions?.updatedAt ?? null,
    },
  }));
}

export interface UpdateCoachPermissionsInput {
  canCreateCoaches?: boolean;
  canEditPrompts?: boolean;
}

export async function updateCoachPermissions(
  coachUserId: string,
  input: UpdateCoachPermissionsInput,
  caller: AuthUser,
) {
  // Sólo admin global puede mover toggles. La verificación está acá además
  // del middleware del route como defensa en profundidad.
  if (!isGlobalAdmin(caller)) {
    throw new BadRequestError('Sólo admin global puede modificar permisos de coach');
  }

  const target = await prisma.user.findUnique({
    where: { id: coachUserId },
    include: {
      roles: { select: { role: true } },
      coachPermissions: true,
    },
  });
  if (!target) throw new NotFoundError('Usuario no encontrado');

  const isCoach = target.roles.some((r) => r.role === 'coach');
  if (!isCoach) {
    throw new BadRequestError('El usuario target no tiene rol coach');
  }

  const updated = await prisma.coachPermission.upsert({
    where: { userId: coachUserId },
    create: {
      userId: coachUserId,
      canCreateCoaches: input.canCreateCoaches ?? false,
      canEditPrompts: input.canEditPrompts ?? false,
      grantedBy: caller.id,
    },
    update: {
      canCreateCoaches: input.canCreateCoaches ?? undefined,
      canEditPrompts: input.canEditPrompts ?? undefined,
      grantedBy: caller.id,
    },
  });

  return {
    userId: coachUserId,
    canCreateCoaches: updated.canCreateCoaches,
    canEditPrompts: updated.canEditPrompts,
    grantedBy: updated.grantedBy,
    updatedAt: updated.updatedAt,
  };
}
