// ============================================
// Citas (Appointments) Service
// ============================================
//
// Las citas son sede-scoped: una cita pertenece a la sede del asesor
// asignado. El listado, las mutaciones y los lookups (directores, users)
// se restringen a la sede del caller — sólo admin global ve todas las sedes.

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { getSedeScope } from '../middleware/sedeScope.js';

export interface CreateCitaInput {
  director: string;
  asesorId: string;
  asesorName: string;
  cliente: string;
  municipio: string;
  ciudad: string;
  zona: string;
  fecha: string; // ISO date string
  horaInicio: string; // "08:00", "09:00", etc.
  tipo?: 'presencial' | 'virtual' | 'telefonica';
  prioridad?: 'alta' | 'media' | 'baja';
  linkSala?: string;
  notas?: string;
}

export interface UpdateCitaInput extends Partial<CreateCitaInput> {}

export interface CitaFilters {
  director?: string;
  prioridad?: 'alta' | 'media' | 'baja';
}

// ============================================
// Get citas by date range
// ============================================
export async function getCitasByRange(
  startDate: string,
  endDate: string,
  caller: AuthUser,
  filters?: CitaFilters,
) {
  const scope = getSedeScope(caller);

  const where: any = {
    fecha: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    },
  };

  if (filters?.director) {
    where.director = filters.director;
  }
  if (filters?.prioridad) {
    where.prioridad = filters.prioridad;
  }
  // Filtro sede-aware: las citas se filtran por la sede del asesor.
  // Para admin global no se aplica filtro (ve todo).
  if (scope.scope === 'sede') {
    where.asesor = { sedeId: scope.sedeId };
  }

  return prisma.cita.findMany({
    where,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    include: {
      asesor: { select: { id: true, email: true, firstName: true, lastName: true } },
      creator: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}

// ============================================
// Create cita
// ============================================
export async function createCita(data: CreateCitaInput, createdBy: string, caller: AuthUser) {
  if (!data.director || !data.asesorId || !data.cliente || !data.fecha || !data.horaInicio) {
    throw new BadRequestError('Campos requeridos: director, asesorId, cliente, fecha, horaInicio');
  }

  // El asesor asignado debe ser de la misma sede del caller (excepto admin global).
  const scope = getSedeScope(caller);
  const asesor = await prisma.user.findUnique({
    where: { id: data.asesorId },
    select: { id: true, sedeId: true },
  });
  if (!asesor) {
    throw new BadRequestError('Asesor no encontrado');
  }
  if (scope.scope === 'sede' && asesor.sedeId !== scope.sedeId) {
    throw new ForbiddenError('No podés crear citas para asesores de otra sede');
  }

  return prisma.cita.create({
    data: {
      director: data.director,
      asesorId: data.asesorId,
      asesorName: data.asesorName,
      cliente: data.cliente,
      municipio: data.municipio,
      ciudad: data.ciudad,
      zona: data.zona,
      fecha: new Date(data.fecha),
      horaInicio: data.horaInicio,
      tipo: data.tipo || 'presencial',
      prioridad: data.prioridad || 'media',
      linkSala: data.linkSala,
      notas: data.notas,
      createdBy,
    },
    include: {
      asesor: { select: { id: true, email: true, firstName: true, lastName: true } },
      creator: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}

// ============================================
// Update cita
// ============================================
export async function updateCita(id: string, data: UpdateCitaInput, caller: AuthUser) {
  const scope = getSedeScope(caller);

  const existing = await prisma.cita.findUnique({
    where: { id },
    include: { asesor: { select: { sedeId: true } } },
  });
  if (!existing) {
    throw new NotFoundError('Cita no encontrada');
  }
  if (scope.scope === 'sede' && existing.asesor.sedeId !== scope.sedeId) {
    // 404 vs 403 — no filtrar existencia.
    throw new NotFoundError('Cita no encontrada');
  }

  // Si se cambia el asesor, validar que el nuevo también sea de la misma sede.
  if (data.asesorId && data.asesorId !== existing.asesorId) {
    const nuevoAsesor = await prisma.user.findUnique({
      where: { id: data.asesorId },
      select: { sedeId: true },
    });
    if (!nuevoAsesor) {
      throw new BadRequestError('Asesor no encontrado');
    }
    if (scope.scope === 'sede' && nuevoAsesor.sedeId !== scope.sedeId) {
      throw new ForbiddenError('No podés asignar la cita a un asesor de otra sede');
    }
  }

  const updateData: any = { ...data };
  if (data.fecha) {
    updateData.fecha = new Date(data.fecha);
  }

  return prisma.cita.update({
    where: { id },
    data: updateData,
    include: {
      asesor: { select: { id: true, email: true, firstName: true, lastName: true } },
      creator: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}

// ============================================
// Delete cita
// ============================================
export async function deleteCita(id: string, caller: AuthUser) {
  const scope = getSedeScope(caller);
  const existing = await prisma.cita.findUnique({
    where: { id },
    include: { asesor: { select: { sedeId: true } } },
  });
  if (!existing) {
    throw new NotFoundError('Cita no encontrada');
  }
  if (scope.scope === 'sede' && existing.asesor.sedeId !== scope.sedeId) {
    throw new NotFoundError('Cita no encontrada');
  }
  return prisma.cita.delete({ where: { id } });
}

// ============================================
// Get distinct directors (filtered by sede)
// ============================================
export async function getDirectors(caller: AuthUser) {
  const scope = getSedeScope(caller);

  const where: any = {};
  if (scope.scope === 'sede') {
    where.asesor = { sedeId: scope.sedeId };
  }

  const result = await prisma.cita.findMany({
    where,
    select: { director: true },
    distinct: ['director'],
    orderBy: { director: 'asc' },
  });
  return result.map((r) => r.director);
}

// ============================================
// Get all users (for asesor selection) — filtered by sede
// ============================================
export async function getUsers(caller: AuthUser) {
  const scope = getSedeScope(caller);

  const where: any = {};
  if (scope.scope === 'sede') {
    where.sedeId = scope.sedeId;
  }

  return prisma.user.findMany({
    where,
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}
