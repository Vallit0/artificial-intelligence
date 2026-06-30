// ============================================
// Período de filtrado (analíticas / estudiantes)
// ============================================
//
// Las cotas se guardan como fechas locales "YYYY-MM-DD" (lo que produce un
// <input type="date">). Al construir el query se convierten a ISO con los
// límites del día (inicio para `from`, fin para `to`) para que el backend filtre
// `createdAt` correctamente.

export interface Period {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
}

export const EMPTY_PERIOD: Period = { from: null, to: null };

export function hasPeriod(p: Period): boolean {
  return !!(p.from || p.to);
}

// ym = "2026-06" -> { from: "2026-06-01", to: "2026-06-30" }
export function monthToPeriod(ym: string): Period {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // día 0 del mes siguiente = último día de este
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function periodEqualsMonth(p: Period, ym: string): boolean {
  const m = monthToPeriod(ym);
  return p.from === m.from && p.to === m.to;
}

// Últimos `count` meses (incluye el actual), más recientes primero.
export function recentMonths(count: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-GT", { month: "long", year: "numeric" });
    out.push({ value: ym, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

// Construye el sufijo de query (?from=...&to=...) en ISO con límites de día.
export function periodToQueryString(p: Period): string {
  const usp = new URLSearchParams();
  if (p.from) usp.set("from", new Date(`${p.from}T00:00:00`).toISOString());
  if (p.to) usp.set("to", new Date(`${p.to}T23:59:59.999`).toISOString());
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// Agrega ?divisionId=... (o &divisionId=...) a un query string ya construido.
// Acepta el sufijo vacío "" y respeta si ya hay parámetros.
export function appendDivision(qs: string, divisionId: string | null): string {
  if (!divisionId) return qs;
  return qs ? `${qs}&divisionId=${encodeURIComponent(divisionId)}` : `?divisionId=${encodeURIComponent(divisionId)}`;
}

// Texto legible del período para nombres de archivo / encabezados de export.
export function periodLabel(p: Period): string {
  if (!hasPeriod(p)) return "Todo el tiempo";
  if (p.from && p.to) return `${p.from} a ${p.to}`;
  if (p.from) return `Desde ${p.from}`;
  return `Hasta ${p.to}`;
}
