// ============================================
// App Config Service (configuración global, singleton)
// ============================================

import prisma from '../db/index.js';

const SINGLETON_ID = 'singleton';

export interface AppConfigPatch {
  callDurationProspeccionSec?: number;
  callDurationObjecionesSec?: number;
  passThresholdProspeccion?: number;
  passThresholdObjeciones?: number;
  certificateInstructorName?: string | null;
  certificateDirectorName?: string | null;
  certificateCourseName?: string | null;
  certificateLevel1InstructorName?: string | null;
  certificateLevel1DirectorName?: string | null;
  certificateLevel1CourseName?: string | null;
}

// Lee la config; si la fila aún no existe, la crea con los defaults del schema.
export async function getAppConfig() {
  const existing = await prisma.appConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;
  return prisma.appConfig.create({ data: { id: SINGLETON_ID } });
}

const clampInt = (n: unknown, min: number, max: number): number | undefined => {
  if (n === undefined || n === null) return undefined;
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return undefined;
  return Math.max(min, Math.min(max, v));
};

const cleanStr = (s: unknown): string | null | undefined => {
  if (s === undefined) return undefined;
  if (s === null) return null;
  const t = String(s).trim();
  return t.length ? t.slice(0, 120) : null;
};

export async function updateAppConfig(patch: AppConfigPatch) {
  // Sanea: duraciones 60s–60min, umbrales 0–100, nombres ≤120 chars.
  const data = {
    callDurationProspeccionSec: clampInt(patch.callDurationProspeccionSec, 60, 3600),
    callDurationObjecionesSec: clampInt(patch.callDurationObjecionesSec, 60, 3600),
    passThresholdProspeccion: clampInt(patch.passThresholdProspeccion, 0, 100),
    passThresholdObjeciones: clampInt(patch.passThresholdObjeciones, 0, 100),
    certificateInstructorName: cleanStr(patch.certificateInstructorName),
    certificateDirectorName: cleanStr(patch.certificateDirectorName),
    certificateCourseName: cleanStr(patch.certificateCourseName),
    certificateLevel1InstructorName: cleanStr(patch.certificateLevel1InstructorName),
    certificateLevel1DirectorName: cleanStr(patch.certificateLevel1DirectorName),
    certificateLevel1CourseName: cleanStr(patch.certificateLevel1CourseName),
  };
  return prisma.appConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}
