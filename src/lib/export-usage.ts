import * as XLSX from "xlsx";
import type { AdminUsageData } from "@/hooks/useAdminUsage";
import type { TimeByModeData } from "@/hooks/useTimeByMode";
import type { Student } from "@/hooks/useStudents";
import { hasPeriod, periodLabel, type Period } from "@/lib/period";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const min = (seconds: number): number => Math.round(seconds / 60);

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

/**
 * Exporta las analíticas de uso a un .xlsx con hojas separadas: Totales, Por
 * sede, Tiempo por modo (totales + por alumno) y Detalle por alumno. Respeta el
 * período pasado (sólo lo usa para el nombre de archivo y un encabezado — los
 * datos ya vienen filtrados por los hooks). `timeByMode` puede ser null si aún
 * no cargó.
 */
export function exportUsageToExcel(
  usage: AdminUsageData,
  timeByMode: TimeByModeData | null,
  students: Student[],
  period: Period,
  fileName?: string,
): void {
  const { totals, bySede } = usage;
  const wb = XLSX.utils.book_new();
  const periodTxt = periodLabel(period);

  // --- Hoja: Totales ---
  const totalesRows = [
    { Métrica: "Período", Valor: periodTxt },
    { Métrica: "Tiempo total", Valor: formatDuration(totals.totalTimeSeconds) },
    { Métrica: "Tiempo total (min)", Valor: min(totals.totalTimeSeconds) },
    { Métrica: "Sesiones totales", Valor: totals.totalSessions },
    { Métrica: "Estudiantes activos", Valor: totals.activeStudents },
    { Métrica: "Estudiantes totales", Valor: totals.totalStudents },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalesRows), "Totales");

  // --- Hoja: Por sede ---
  const sedeRows = bySede.map((s) => ({
    Sede: s.sedeName,
    "Tiempo total": formatDuration(s.totalTimeSeconds),
    "Tiempo total (min)": min(s.totalTimeSeconds),
    Sesiones: s.totalSessions,
    "Estudiantes activos": s.activeStudents,
    "Estudiantes totales": s.totalStudents,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(sedeRows.length ? sedeRows : [{ Sede: "Sin datos" }]),
    "Por sede",
  );

  // --- Hoja: Tiempo por modo ---
  if (timeByMode) {
    const t = timeByMode.totals;
    const modoTotales = [
      { Modo: "Role-Play Cliente (Nivel 1)", "Tiempo (min)": min(t.roleplayClienteSeconds) },
      { Modo: "· Prospección", "Tiempo (min)": min(t.prospeccionSeconds) },
      { Modo: "· Cliente (otros)", "Tiempo (min)": min(t.clienteOtrosSeconds) },
      { Modo: "Role-Play Objeciones", "Tiempo (min)": min(t.roleplayObjecionesSeconds) },
      { Modo: "Role-Play Asesor", "Tiempo (min)": min(t.roleplayAsesorSeconds) },
      { Modo: "Coach", "Tiempo (min)": min(t.coachSeconds) },
      { Modo: "Examen Prospección", "Tiempo (min)": min(t.examenProspeccionSeconds) },
      { Modo: "Examen Objeciones", "Tiempo (min)": min(t.examenObjecionesSeconds) },
      { Modo: "Sin clasificar", "Tiempo (min)": min(t.sinClasificarSeconds) },
      { Modo: "TOTAL", "Tiempo (min)": min(t.totalSeconds) },
    ];
    const modoPorAlumno = timeByMode.byStudent.map((s) => ({
      Alumno: s.name,
      "Cliente (Nivel 1) min": min(s.roleplayClienteSeconds),
      "Prospección min": min(s.prospeccionSeconds),
      "Objeciones min": min(s.roleplayObjecionesSeconds),
      "Asesor min": min(s.roleplayAsesorSeconds),
      "Coach min": min(s.coachSeconds),
      "Total min": min(s.totalSeconds),
    }));
    // Encabezado de totales, una fila en blanco y luego el detalle por alumno.
    const sheet = XLSX.utils.json_to_sheet(modoTotales);
    XLSX.utils.sheet_add_json(sheet, modoPorAlumno, { origin: -1 });
    XLSX.utils.book_append_sheet(wb, sheet, "Tiempo por modo");
  }

  // --- Hoja: Detalle por alumno ---
  const alumnoRows = students.map((st) => ({
    Nombre: [st.first_name, st.last_name].filter(Boolean).join(" ") || (st.email ?? ""),
    Email: st.email ?? "",
    Teléfono: st.phoneNumber ?? "",
    Sede: st.sedeName ?? "",
    Coach: st.coachName ?? "",
    Sesiones: st.totalSessions,
    "Tiempo total": formatDuration(st.totalDuration),
    "Tiempo total (min)": min(st.totalDuration),
    "Fecha de registro": st.created_at ? new Date(st.created_at).toLocaleDateString("es-GT") : "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(alumnoRows.length ? alumnoRows : [{ Nombre: "Sin datos" }]),
    "Por alumno",
  );

  const suffix = hasPeriod(period) ? `-${period.from ?? "inicio"}_${period.to ?? "hoy"}` : "";
  XLSX.writeFile(wb, fileName ?? `uso-analytics${suffix}.xlsx`);
}
