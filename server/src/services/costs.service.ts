// ============================================
// Cost Analytics Service
// ============================================
//
// Estima el costo de operación del periodo agrupando por dimensión
// (sede, usuario o escenario). En esta versión sólo se calcula el costo
// de ElevenLabs porque es lo único persistido con suficiente detalle
// (PracticeSession.durationSeconds). El costo de OpenAI queda en 0 hasta
// que se persistan tokens por evaluación — el response declara
// `openaiCostTracked: false` para que la UI muestre el placeholder.
//
// Infra (Huawei) es un costo fijo mensual: se prorratea linealmente al
// rango consultado.

import prisma from '../db/index.js';
import { AuthUser } from '../types/index.js';
import { getSedeScope } from '../middleware/sedeScope.js';
import { BadRequestError } from '../utils/errors.js';
import { getActiveRateMap } from './pricing.service.js';

export type GroupBy = 'sede' | 'user' | 'scenario';

export interface CostsQuery {
  from: Date;
  to: Date;
  groupBy: GroupBy;
  limit: number;
  sedeIdFilter?: string | null;
  divisionIdFilter?: string | null;
}

export interface CostBreakdownEntry {
  key: string;
  label: string;
  sessions: number;
  minutes: number;
  elevenlabsCostUsd: number;
  openaiCostUsd: number;
  totalCostUsd: number;
  pctOfTotal: number;
}

export interface AppliedRates {
  elevenlabsPerMinuteUsd: number | null;
  openaiPerInputTokenUsd: number | null;
  openaiPerOutputTokenUsd: number | null;
  infraMonthlyUsd: number | null;
}

export interface CostBreakdownResponse {
  from: string;
  to: string;
  groupBy: GroupBy;
  sessions: number;
  minutes: number;
  totals: {
    elevenlabsCostUsd: number;
    openaiCostUsd: number;
    infraCostUsd: number;
    totalCostUsd: number;
  };
  breakdown: CostBreakdownEntry[];
  appliedRates: AppliedRates;
  openaiCostTracked: boolean;
  generatedAt: string;
}

const MAX_RANGE_DAYS = 365;

export function parseCostsQuery(raw: {
  from?: string;
  to?: string;
  groupBy?: string;
  limit?: string;
  sedeId?: string;
  divisionId?: string;
}): CostsQuery {
  if (!raw.from || !raw.to) {
    throw new BadRequestError('Faltan parámetros from/to (ISO-8601)');
  }
  const from = new Date(raw.from);
  const to = new Date(raw.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestError('from/to deben ser fechas ISO válidas');
  }
  if (from >= to) {
    throw new BadRequestError('from debe ser anterior a to');
  }
  const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new BadRequestError(`Rango máximo: ${MAX_RANGE_DAYS} días`);
  }

  const groupBy = (raw.groupBy ?? 'sede') as GroupBy;
  if (!['sede', 'user', 'scenario'].includes(groupBy)) {
    throw new BadRequestError('groupBy debe ser sede|user|scenario');
  }

  const limit = raw.limit ? Math.min(Math.max(parseInt(raw.limit, 10) || 20, 1), 100) : 20;

  return {
    from,
    to,
    groupBy,
    limit,
    sedeIdFilter: raw.sedeId || null,
    divisionIdFilter: raw.divisionId || null,
  };
}

interface RawAggRow {
  key: string | null;
  sessions: number;
  totalSeconds: number;
}

// Una sola query agregada por groupBy. Postgres agrupa, ordena, limita —
// no traemos N filas de sesiones al backend.
async function fetchRawAggregates(query: CostsQuery, sedeIdsAllowed: string[] | null): Promise<RawAggRow[]> {
  const { from, to, groupBy, limit, sedeIdFilter, divisionIdFilter } = query;

  // Construcción de WHERE con parámetros tipados. Prisma no soporta
  // groupBy dinámico con joins, así que usamos $queryRawUnsafe con
  // valores parametrizados (no string-concat de input del cliente).
  const conditions: string[] = ['ps.created_at >= $1', 'ps.created_at < $2'];
  const params: unknown[] = [from, to];

  if (sedeIdsAllowed && sedeIdsAllowed.length > 0) {
    // sede_id es TEXT (Prisma mapea String → text), así que el array param
    // se castea a text[] — no uuid[] — o Postgres lanza 42883 (text = uuid).
    conditions.push(`u.sede_id = ANY($${params.length + 1}::text[])`);
    params.push(sedeIdsAllowed);
  } else if (sedeIdFilter) {
    conditions.push(`u.sede_id = $${params.length + 1}::text`);
    params.push(sedeIdFilter);
  }

  // Filtro por división (aditivo): acota a los learners de esa división.
  if (divisionIdFilter) {
    conditions.push(`u.division_id = $${params.length + 1}::text`);
    params.push(divisionIdFilter);
  }

  const whereSql = conditions.join(' AND ');

  let groupExpr: string;
  if (groupBy === 'sede') {
    groupExpr = 'u.sede_id::text';
  } else if (groupBy === 'user') {
    groupExpr = 'ps.user_id::text';
  } else {
    groupExpr = 'ps.scenario_id::text';
  }

  const sql = `
    SELECT ${groupExpr} AS key,
           COUNT(*)::int AS sessions,
           COALESCE(SUM(ps.duration_seconds), 0)::int AS "totalSeconds"
    FROM practice_sessions ps
    JOIN users u ON u.id = ps.user_id
    WHERE ${whereSql}
    GROUP BY ${groupExpr}
    ORDER BY "totalSeconds" DESC
    LIMIT ${limit}
  `;

  return prisma.$queryRawUnsafe<RawAggRow[]>(sql, ...params);
}

async function resolveLabels(groupBy: GroupBy, keys: string[]): Promise<Map<string, string>> {
  const nonNullKeys = keys.filter((k): k is string => typeof k === 'string' && k.length > 0);
  if (nonNullKeys.length === 0) return new Map();

  if (groupBy === 'sede') {
    const rows = await prisma.sede.findMany({
      where: { id: { in: nonNullKeys } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }
  if (groupBy === 'user') {
    const rows = await prisma.user.findMany({
      where: { id: { in: nonNullKeys } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email,
      ]),
    );
  }
  // scenario
  const rows = await prisma.scenario.findMany({
    where: { id: { in: nonNullKeys } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function getCostBreakdown(query: CostsQuery, user: AuthUser): Promise<CostBreakdownResponse> {
  const scope = getSedeScope(user, query.sedeIdFilter);
  const sedeIdsAllowed = scope.scope === 'sede' ? [scope.sedeId] : null;

  const [rates, rawRows] = await Promise.all([
    getActiveRateMap(),
    fetchRawAggregates(query, sedeIdsAllowed),
  ]);

  const elevenlabsPerMin = rates.get('elevenlabs:per_minute') ?? null;
  const openaiInputRate = rates.get('openai:per_token_input') ?? null;
  const openaiOutputRate = rates.get('openai:per_token_output') ?? null;
  const infraMonthly = rates.get('infra:monthly') ?? null;

  // Mientras no haya columnas de tokens en PracticeSession, no podemos
  // atribuir costo de OpenAI a sesiones individuales. Lo dejamos en 0
  // y la UI muestra el placeholder.
  const openaiCostTracked = false;

  const labels = await resolveLabels(query.groupBy, rawRows.map((r) => r.key ?? ''));

  let totalSeconds = 0;
  let totalSessions = 0;
  const enriched = rawRows.map((row) => {
    const minutes = row.totalSeconds / 60;
    const elevenlabsCostUsd = elevenlabsPerMin != null ? minutes * elevenlabsPerMin : 0;
    const openaiCostUsd = 0;
    totalSeconds += row.totalSeconds;
    totalSessions += row.sessions;
    return {
      row,
      minutes,
      elevenlabsCostUsd,
      openaiCostUsd,
      totalCostUsd: elevenlabsCostUsd + openaiCostUsd,
    };
  });

  const totalElevenlabs = enriched.reduce((s, e) => s + e.elevenlabsCostUsd, 0);
  const totalOpenai = 0;
  const rangeMs = query.to.getTime() - query.from.getTime();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const infraCostUsd = infraMonthly != null ? (infraMonthly * rangeMs) / monthMs : 0;
  const totalGrand = totalElevenlabs + totalOpenai + infraCostUsd;

  const breakdown: CostBreakdownEntry[] = enriched.map((e) => ({
    key: e.row.key ?? 'unknown',
    label: e.row.key ? labels.get(e.row.key) ?? '(sin nombre)' : '(sin asignar)',
    sessions: e.row.sessions,
    minutes: Number(e.minutes.toFixed(2)),
    elevenlabsCostUsd: Number(e.elevenlabsCostUsd.toFixed(4)),
    openaiCostUsd: 0,
    totalCostUsd: Number(e.totalCostUsd.toFixed(4)),
    pctOfTotal: totalGrand > 0 ? Number(((e.totalCostUsd / totalGrand) * 100).toFixed(2)) : 0,
  }));

  return {
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    groupBy: query.groupBy,
    sessions: totalSessions,
    minutes: Number((totalSeconds / 60).toFixed(2)),
    totals: {
      elevenlabsCostUsd: Number(totalElevenlabs.toFixed(4)),
      openaiCostUsd: 0,
      infraCostUsd: Number(infraCostUsd.toFixed(4)),
      totalCostUsd: Number(totalGrand.toFixed(4)),
    },
    breakdown,
    appliedRates: {
      elevenlabsPerMinuteUsd: elevenlabsPerMin,
      openaiPerInputTokenUsd: openaiInputRate,
      openaiPerOutputTokenUsd: openaiOutputRate,
      infraMonthlyUsd: infraMonthly,
    },
    openaiCostTracked,
    generatedAt: new Date().toISOString(),
  };
}
