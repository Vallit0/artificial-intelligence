// ============================================
// Rango de fechas (filtros de analítica)
// ============================================
//
// Parsea from/to OPCIONALES desde el query string. Ambos pueden faltar (=> sin
// filtro, comportamiento histórico). Si viene uno, debe ser una fecha ISO
// válida. Pensado para filtrar `createdAt` de practice_sessions por período
// (rango libre o un mes concreto, que el frontend manda como from/to).

import { BadRequestError } from './errors.js';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export function parseDateRange(raw: { from?: unknown; to?: unknown }): DateRange {
  const range: DateRange = {};

  if (typeof raw.from === 'string' && raw.from.trim() !== '') {
    const from = new Date(raw.from);
    if (Number.isNaN(from.getTime())) {
      throw new BadRequestError('from debe ser una fecha ISO válida');
    }
    range.from = from;
  }

  if (typeof raw.to === 'string' && raw.to.trim() !== '') {
    const to = new Date(raw.to);
    if (Number.isNaN(to.getTime())) {
      throw new BadRequestError('to debe ser una fecha ISO válida');
    }
    range.to = to;
  }

  if (range.from && range.to && range.from > range.to) {
    throw new BadRequestError('from debe ser anterior o igual a to');
  }

  return range;
}

// Construye el sub-filtro Prisma sobre `createdAt`. Devuelve {} cuando no hay
// rango, para poder hacer spread directo dentro de un `where`.
export function createdAtWhere(range: DateRange | undefined): { createdAt?: { gte?: Date; lte?: Date } } {
  if (!range || (!range.from && !range.to)) return {};
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (range.from) createdAt.gte = range.from;
  if (range.to) createdAt.lte = range.to;
  return { createdAt };
}
