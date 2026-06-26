import * as XLSX from "xlsx";
import type { Student } from "@/hooks/useStudents";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

/**
 * Exporta la lista completa de estudiantes a un archivo .xlsx.
 * Enfocado en datos de uso/identidad — no incluye el "Promedio IA".
 */
export function exportStudentsToExcel(students: Student[], fileName = "estudiantes.xlsx"): void {
  const rows = students.map((s) => ({
    Nombre: s.first_name ?? "",
    Apellido: s.last_name ?? "",
    Email: s.email ?? "",
    Teléfono: s.phoneNumber ?? "",
    Sede: s.sedeName ?? "",
    País: s.country ?? "",
    División: s.divisionName ?? "",
    Coach: s.coachName ?? "",
    Sesiones: s.totalSessions,
    "Tiempo total": formatDuration(s.totalDuration),
    "Tiempo total (min)": Math.round(s.totalDuration / 60),
    "Examen Prospección": s.examenFinalEnabled ? "Habilitado" : "Bloqueado",
    "Examen Objeciones": s.examenObjecionesEnabled ? "Habilitado" : "Bloqueado",
    Nivel: s.level2Unlocked ? "Nivel 2" : "Nivel 1",
    "Nota final": s.finalGrade ?? "",
    "Fecha de registro": s.created_at
      ? new Date(s.created_at).toLocaleDateString("es-GT")
      : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Estudiantes");
  XLSX.writeFile(workbook, fileName);
}

export interface GroupSummaryRow {
  group: string;
  count: number;
  sessions: number;
  seconds: number;
}

/**
 * Exporta el resumen de práctica agrupado (por división / país / sede) a .xlsx.
 * Una hoja "Resumen" con Grupo, Estudiantes, Sesiones, Tiempo total (+min) y
 * una fila TOTAL al pie. `groupByKey` se usa sólo para el nombre del archivo.
 */
export function exportStudentSummaryToExcel(
  rows: GroupSummaryRow[],
  groupLabel: string,
  groupByKey: string,
): void {
  const data = rows.map((r) => ({
    [groupLabel]: r.group,
    Estudiantes: r.count,
    Sesiones: r.sessions,
    "Tiempo total": formatDuration(r.seconds),
    "Tiempo total (min)": Math.round(r.seconds / 60),
  }));

  data.push({
    [groupLabel]: "TOTAL",
    Estudiantes: rows.reduce((a, r) => a + r.count, 0),
    Sesiones: rows.reduce((a, r) => a + r.sessions, 0),
    "Tiempo total": formatDuration(rows.reduce((a, r) => a + r.seconds, 0)),
    "Tiempo total (min)": Math.round(rows.reduce((a, r) => a + r.seconds, 0) / 60),
  });

  const worksheet = XLSX.utils.json_to_sheet(data.length ? data : [{ [groupLabel]: "Sin datos" }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen");
  XLSX.writeFile(workbook, `resumen-por-${groupByKey}.xlsx`);
}
