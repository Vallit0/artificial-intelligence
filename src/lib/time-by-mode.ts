// ============================================
// Desglose de tiempo de práctica por modo (cliente)
// ============================================
//
// Espejo de la agregación del backend (server/src/services/analytics.service.ts
// → aggregateTimeByMode). La "primera parte" (Nivel 1) cuenta SÓLO la familia
// Role-Play Cliente, dentro de la cual Prospección es un sub-modo. Mantener
// ambos lados en sincronía: si cambia un modo acá, cambiarlo allá.

export type PracticeMode =
  | "cliente"
  | "cliente_prospeccion"
  | "asesor"
  | "objeciones"
  | "coach";

export interface TimeByMode {
  roleplayClienteSeconds: number; // familia Cliente = cliente + prospección (métrica Nivel 1)
  prospeccionSeconds: number; // sub-modo de Cliente
  clienteOtrosSeconds: number; // Cliente que no es prospección
  roleplayObjecionesSeconds: number;
  roleplayAsesorSeconds: number;
  coachSeconds: number;
  examenProspeccionSeconds: number;
  examenObjecionesSeconds: number;
  sinClasificarSeconds: number;
  totalSeconds: number;
}

export const EMPTY_TIME_BY_MODE: TimeByMode = {
  roleplayClienteSeconds: 0,
  prospeccionSeconds: 0,
  clienteOtrosSeconds: 0,
  roleplayObjecionesSeconds: 0,
  roleplayAsesorSeconds: 0,
  coachSeconds: 0,
  examenProspeccionSeconds: 0,
  examenObjecionesSeconds: 0,
  sinClasificarSeconds: 0,
  totalSeconds: 0,
};

interface SessionModeRow {
  durationSeconds: number;
  practiceMode: string | null;
  examType: string | null;
}

export function aggregateTimeByMode(sessions: SessionModeRow[]): TimeByMode {
  const acc: TimeByMode = { ...EMPTY_TIME_BY_MODE };

  for (const s of sessions) {
    const d = s.durationSeconds || 0;
    acc.totalSeconds += d;

    switch (s.practiceMode) {
      case "cliente":
        acc.clienteOtrosSeconds += d;
        acc.roleplayClienteSeconds += d;
        continue;
      case "cliente_prospeccion":
        acc.prospeccionSeconds += d;
        acc.roleplayClienteSeconds += d;
        continue;
      case "objeciones":
        acc.roleplayObjecionesSeconds += d;
        continue;
      case "asesor":
        acc.roleplayAsesorSeconds += d;
        continue;
      case "coach":
        acc.coachSeconds += d;
        continue;
    }

    if (s.examType === "prospeccion") acc.examenProspeccionSeconds += d;
    else if (s.examType === "objeciones") acc.examenObjecionesSeconds += d;
    else acc.sinClasificarSeconds += d;
  }

  return acc;
}

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
