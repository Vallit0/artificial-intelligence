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
    Sesiones: s.totalSessions,
    "Tiempo total": formatDuration(s.totalDuration),
    "Tiempo total (min)": Math.round(s.totalDuration / 60),
    "Examen final": s.examenFinalEnabled ? "Habilitado" : "Bloqueado",
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
