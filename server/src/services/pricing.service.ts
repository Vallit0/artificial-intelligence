// ============================================
// Pricing Rates Service
// ============================================
//
// Tarifas inmutables: la tarifa "vigente" para un (service, unit) es la
// fila con isActive=true cuya ventana effectiveFrom..effectiveTo cubre
// el instante consultado. Al crear una nueva tarifa se cierra la
// anterior con effectiveTo=now() para preservar el historial — nunca
// se hace UPDATE del unitPriceUsd in-place.

import { Prisma, PricingService, PricingUnit } from '@prisma/client';
import prisma from '../db/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export interface PricingRateDTO {
  id: string;
  service: PricingService;
  unit: PricingUnit;
  unitPriceUsd: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: Prisma.PricingRateGetPayload<{}>): PricingRateDTO {
  return {
    id: row.id,
    service: row.service,
    unit: row.unit,
    unitPriceUsd: row.unitPriceUsd.toString(),
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    isActive: row.isActive,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listActiveRates(): Promise<PricingRateDTO[]> {
  const rows = await prisma.pricingRate.findMany({
    where: { isActive: true },
    orderBy: [{ service: 'asc' }, { unit: 'asc' }],
  });
  return rows.map(toDTO);
}

export async function listAllRates(service?: PricingService, unit?: PricingUnit): Promise<PricingRateDTO[]> {
  const rows = await prisma.pricingRate.findMany({
    where: {
      ...(service ? { service } : {}),
      ...(unit ? { unit } : {}),
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return rows.map(toDTO);
}

export interface CreateRateInput {
  service: PricingService;
  unit: PricingUnit;
  unitPriceUsd: string;
  notes?: string | null;
  createdBy?: string | null;
}

// Crea una tarifa nueva y cierra la anterior con effectiveTo=now(). Todo
// dentro de una transacción para evitar dos rows activas simultáneas si
// dos requests entran a la vez.
export async function createNewRate(input: CreateRateInput): Promise<PricingRateDTO> {
  const priceNum = Number(input.unitPriceUsd);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    throw new BadRequestError('unitPriceUsd debe ser un número >= 0');
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await tx.pricingRate.updateMany({
      where: {
        service: input.service,
        unit: input.unit,
        isActive: true,
      },
      data: { isActive: false, effectiveTo: now },
    });

    return tx.pricingRate.create({
      data: {
        service: input.service,
        unit: input.unit,
        unitPriceUsd: input.unitPriceUsd,
        effectiveFrom: now,
        isActive: true,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
      },
    });
  });

  return toDTO(created);
}

export interface UpdateMetadataInput {
  notes?: string | null;
  isActive?: boolean;
}

// PATCH sobre metadata sin tocar el precio. Si se desactiva la tarifa
// activa, queda sin tarifa vigente para ese (service, unit) hasta que
// se cree una nueva — el panel de costos marca el servicio como "sin
// tarifa configurada" en ese caso.
export async function updateRateMetadata(id: string, input: UpdateMetadataInput): Promise<PricingRateDTO> {
  const existing = await prisma.pricingRate.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('PricingRate no encontrado');
  }

  const updated = await prisma.pricingRate.update({
    where: { id },
    data: {
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
            effectiveTo: input.isActive ? null : new Date(),
          }
        : {}),
    },
  });
  return toDTO(updated);
}

// Map { service: { unit: priceNum } } con las tarifas vigentes — lo
// consume el costs service para no hacer N queries.
export async function getActiveRateMap(): Promise<Map<string, number>> {
  const rows = await prisma.pricingRate.findMany({ where: { isActive: true } });
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(`${r.service}:${r.unit}`, Number(r.unitPriceUsd));
  }
  return map;
}
