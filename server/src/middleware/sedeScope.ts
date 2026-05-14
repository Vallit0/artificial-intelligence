// ============================================
// Sede Scope Helpers
// ============================================
//
// El aislamiento entre sedes es duro: un coach/instructor/learner sólo
// puede operar sobre datos de su propia sede. Sólo el rol `admin` global
// puede atravesar sedes (y opcionalmente pasar `?sedeId=X` para inspeccionar
// otra sede desde la UI admin).
//
// Estos helpers centralizan la decisión "¿qué sede ve este request?" para
// que los services no tengan que repetir la lógica en cada query.

import { AuthUser, AppRole } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export type SedeScope =
  | { scope: 'global' }                  // admin global, ve todas las sedes
  | { scope: 'sede'; sedeId: string };   // resto: scoped a su sede

// Determina el alcance de visibilidad para el caller. `overrideSedeId`
// es para el caso de un admin global que pasa ?sedeId=X en la URL —
// queremos que el query se restrinja a esa sede sin perder el privilegio.
export function getSedeScope(user: AuthUser | undefined, overrideSedeId?: string | null): SedeScope {
  if (!user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const isGlobalAdmin = user.roles.includes('admin');
  if (isGlobalAdmin) {
    if (overrideSedeId) {
      return { scope: 'sede', sedeId: overrideSedeId };
    }
    return { scope: 'global' };
  }

  // Coaches, instructores y learners requieren sedeId. Durante el backfill
  // pueden quedar users con sedeId null — los rechazamos hasta que un admin
  // los asigne, en vez de tratarlos como "ven todo".
  if (!user.sedeId) {
    throw new ForbiddenError('Tu usuario no tiene sede asignada. Contactá a un administrador.');
  }
  return { scope: 'sede', sedeId: user.sedeId };
}

// Verifica que `targetSedeId` cae dentro del alcance del caller. Útil al
// mutar/leer un recurso por ID donde primero tenés que cargar el recurso
// (o su user dueño) y validar que pertenece a la sede del caller.
export function assertSedeAccess(user: AuthUser | undefined, targetSedeId: string | null): void {
  const scope = getSedeScope(user);
  if (scope.scope === 'global') return;
  if (!targetSedeId || targetSedeId !== scope.sedeId) {
    throw new ForbiddenError('No tenés acceso a este recurso (sede distinta)');
  }
}

// Predicate inverso conveniente para chequeos "este user es admin global".
export function isGlobalAdmin(user: AuthUser | undefined): boolean {
  return !!user && user.roles.includes('admin');
}

// True si el caller puede crear coaches en `targetSedeId`. Admin global
// puede crear en cualquier sede; un coach con `canCreateCoaches` sólo en
// su propia sede.
export function canCreateCoachIn(user: AuthUser | undefined, targetSedeId: string): boolean {
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (!user.roles.includes('coach')) return false;
  if (!user.coachPermissions?.canCreateCoaches) return false;
  return user.sedeId === targetSedeId;
}

// True si el caller puede editar prompts globales de prospección. Admin
// global puede siempre; un coach sólo si tiene canEditPrompts.
export function canEditPrompts(user: AuthUser | undefined): boolean {
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (!user.roles.includes('coach')) return false;
  return !!user.coachPermissions?.canEditPrompts;
}

// Helper para usar como middleware: rechaza si el caller no es admin
// global. Más expresivo que `requireRole('admin')` cuando el endpoint es
// específicamente global-only (CRUD de sedes, gestión de coaches, etc.).
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';

export function requireGlobalAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    if (!isGlobalAdmin(req.user)) {
      throw new ForbiddenError('Sólo admin global puede acceder');
    }
    next();
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// Re-exporta tipos auxiliares.
export type { AppRole };
