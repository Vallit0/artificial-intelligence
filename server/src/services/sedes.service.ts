// ============================================
// Sedes Service
// ============================================
//
// CRUD de sedes. Sólo invocable por admin global (los routes aplican
// requireGlobalAdmin antes). Las operaciones de mutación validan que la
// sede no quede con usuarios huérfanos: borrar una sede que tiene users
// está prohibido (onDelete: Restrict en el schema lo enforza igualmente,
// pero acá lanzamos un error explicativo antes de delegar al DB).

import prisma from '../db/index.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

export interface CreateSedeInput {
  slug: string;
  name: string;
  country?: string;
  city?: string;
  address?: string;
}

export interface UpdateSedeInput {
  slug?: string;
  name?: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  isActive?: boolean;
}

function validateSlug(slug: string) {
  // Slug estable para URLs y referencias en código: lowercase, alfanumérico
  // y guiones. Esta validación es defensiva — la UI ya debería normalizar.
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) {
    throw new BadRequestError('Slug inválido: lowercase, alfanumérico y guiones, 2-64 chars');
  }
}

export async function listSedes(opts?: { includeInactive?: boolean }) {
  return prisma.sede.findMany({
    where: opts?.includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getSedeById(id: string) {
  const sede = await prisma.sede.findUnique({ where: { id } });
  if (!sede) throw new NotFoundError('Sede no encontrada');
  return sede;
}

export async function createSede(input: CreateSedeInput) {
  const slug = input.slug.trim().toLowerCase();
  validateSlug(slug);
  if (!input.name?.trim()) {
    throw new BadRequestError('Nombre de sede requerido');
  }

  const existing = await prisma.sede.findFirst({
    where: { OR: [{ slug }, { name: input.name.trim() }] },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('Ya existe una sede con ese slug o nombre');
  }

  return prisma.sede.create({
    data: {
      slug,
      name: input.name.trim(),
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
    },
  });
}

export async function updateSede(id: string, input: UpdateSedeInput) {
  const existing = await prisma.sede.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Sede no encontrada');

  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();
    validateSlug(slug);
    if (slug !== existing.slug) {
      const collision = await prisma.sede.findUnique({ where: { slug } });
      if (collision) throw new ConflictError('Slug ya en uso');
    }
  }
  if (input.name !== undefined && input.name.trim() !== existing.name) {
    const collision = await prisma.sede.findUnique({ where: { name: input.name.trim() } });
    if (collision) throw new ConflictError('Nombre ya en uso');
  }

  return prisma.sede.update({
    where: { id },
    data: {
      slug: input.slug !== undefined ? input.slug.trim().toLowerCase() : undefined,
      name: input.name !== undefined ? input.name.trim() : undefined,
      country: input.country !== undefined ? input.country?.trim() || null : undefined,
      city: input.city !== undefined ? input.city?.trim() || null : undefined,
      address: input.address !== undefined ? input.address?.trim() || null : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
    },
  });
}

export async function deleteSede(id: string) {
  const userCount = await prisma.user.count({ where: { sedeId: id } });
  if (userCount > 0) {
    throw new ConflictError(
      `No se puede eliminar la sede: tiene ${userCount} usuario(s) asignado(s). Reasignalos o desactivá la sede.`,
    );
  }
  await prisma.sede.delete({ where: { id } });
  return { success: true };
}
