// ============================================
// Citas (Appointments) Service
// ============================================

import prisma from '../db/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

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
  filters?: CitaFilters
) {
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

  return prisma.cita.findMany({
    where,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    include: {
      asesor: { select: { id: true, email: true, fullName: true } },
      creator: { select: { id: true, email: true, fullName: true } },
    },
  });
}

// ============================================
// Create cita
// ============================================
export async function createCita(data: CreateCitaInput, createdBy: string) {
  if (!data.director || !data.asesorId || !data.cliente || !data.fecha || !data.horaInicio) {
    throw new BadRequestError('Campos requeridos: director, asesorId, cliente, fecha, horaInicio');
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
      asesor: { select: { id: true, email: true, fullName: true } },
      creator: { select: { id: true, email: true, fullName: true } },
    },
  });
}

// ============================================
// Update cita
// ============================================
export async function updateCita(id: string, data: UpdateCitaInput) {
  const existing = await prisma.cita.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Cita no encontrada');
  }

  const updateData: any = { ...data };
  if (data.fecha) {
    updateData.fecha = new Date(data.fecha);
  }

  return prisma.cita.update({
    where: { id },
    data: updateData,
    include: {
      asesor: { select: { id: true, email: true, fullName: true } },
      creator: { select: { id: true, email: true, fullName: true } },
    },
  });
}

// ============================================
// Delete cita
// ============================================
export async function deleteCita(id: string) {
  const existing = await prisma.cita.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Cita no encontrada');
  }

  return prisma.cita.delete({ where: { id } });
}

// ============================================
// Get distinct directors
// ============================================
export async function getDirectors() {
  const result = await prisma.cita.findMany({
    select: { director: true },
    distinct: ['director'],
    orderBy: { director: 'asc' },
  });
  return result.map((r) => r.director);
}

// ============================================
// Get all users (for asesor selection)
// ============================================
export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
}
