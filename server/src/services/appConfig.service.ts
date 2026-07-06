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
  certificateInstructorSignature?: string | null;
  certificateDirectorSignature?: string | null;
  certificateLevel1InstructorSignature?: string | null;
  certificateLevel1DirectorSignature?: string | null;
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

// Firma como imagen: aceptamos sólo data URIs de imagen (data:image/...;base64,)
// para no permitir URLs externas que tainten el canvas en html2canvas. Tope de
// ~2 MB de texto base64 para evitar payloads abusivos. Vacío/otros => null.
const MAX_SIGNATURE_LEN = 2_000_000;
const cleanImage = (s: unknown): string | null | undefined => {
  if (s === undefined) return undefined;
  if (s === null) return null;
  const t = String(s).trim();
  if (!t.length) return null;
  if (!t.startsWith('data:image/')) return null;
  return t.length <= MAX_SIGNATURE_LEN ? t : null;
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
    certificateInstructorSignature: cleanImage(patch.certificateInstructorSignature),
    certificateDirectorSignature: cleanImage(patch.certificateDirectorSignature),
    certificateLevel1InstructorSignature: cleanImage(patch.certificateLevel1InstructorSignature),
    certificateLevel1DirectorSignature: cleanImage(patch.certificateLevel1DirectorSignature),
  };
  return prisma.appConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}
