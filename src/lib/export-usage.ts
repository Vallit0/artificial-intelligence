import type { AdminUsageData } from "@/hooks/useAdminUsage";
import type { Student } from "@/hooks/useStudents";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// Escapa un valor para CSV: encierra entre comillas si contiene coma, comilla
// o salto de línea, y duplica las comillas internas (RFC 4180).
const esc = (value: unknown): string => {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const row = (cells: unknown[]): string => cells.map(esc).join(",");

/**
 * Exporta TODAS las analíticas de uso a un único archivo .csv con cuatro
 * secciones separadas (totales globales, uso por sede, tendencia diaria y
 * detalle por estudiante). Se genera 100% en el cliente con los datos ya
 * cargados — no requiere endpoint adicional.
 *
 * El detalle por estudiante no incluye sede: el API de estudiantes
 * (`/api/admin/students`) no expone `sedeId` por usuario hoy.
 */
export function exportUsageToCsv(
  usage: AdminUsageData,
  students: Student[],
  fileName = "uso-analytics.csv",
): void {
  const { totals, bySede, activityTrend } = usage;
  const lines: string[] = [];

  // --- Totales globales ---
  lines.push("TOTALES GLOBALES");
  lines.push(row(["Métrica", "Valor"]));
  lines.push(row(["Tiempo total", formatDuration(totals.totalTimeSeconds)]));
  lines.push(row(["Tiempo total (min)", Math.round(totals.totalTimeSeconds / 60)]));
  lines.push(row(["Sesiones totales", totals.totalSessions]));
  lines.push(row(["Estudiantes activos", totals.activeStudents]));
  lines.push(row(["Estudiantes totales", totals.totalStudents]));
  lines.push("");

  // --- Uso por sede ---
  lines.push("USO POR SEDE");
  lines.push(
    row([
      "Sede",
      "Tiempo total",
      "Tiempo total (min)",
      "Sesiones",
      "Estudiantes activos",
      "Estudiantes totales",
    ]),
  );
  for (const s of bySede) {
    lines.push(
      row([
        s.sedeName,
        formatDuration(s.totalTimeSeconds),
        Math.round(s.totalTimeSeconds / 60),
        s.totalSessions,
        s.activeStudents,
        s.totalStudents,
      ]),
    );
  }
  lines.push("");

  // --- Tendencia diaria (últimos 30 días) ---
  lines.push("TENDENCIA DIARIA (30 DÍAS)");
  lines.push(row(["Fecha", "Sesiones"]));
  for (const d of activityTrend) {
    lines.push(row([d.date, d.count]));
  }
  lines.push("");

  // --- Detalle por estudiante ---
  lines.push("DETALLE POR ESTUDIANTE");
  lines.push(
    row([
      "Nombre",
      "Email",
      "Teléfono",
      "Sesiones",
      "Tiempo total",
      "Tiempo total (min)",
      "Fecha de registro",
    ]),
  );
  for (const st of students) {
    const name = [st.first_name, st.last_name].filter(Boolean).join(" ") || (st.email ?? "");
    lines.push(
      row([
        name,
        st.email ?? "",
        st.phoneNumber ?? "",
        st.totalSessions,
        formatDuration(st.totalDuration),
        Math.round(st.totalDuration / 60),
        st.created_at ? new Date(st.created_at).toLocaleDateString("es-GT") : "",
      ]),
    );
  }

  // BOM para que Excel interprete UTF-8 (acentos) correctamente.
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
