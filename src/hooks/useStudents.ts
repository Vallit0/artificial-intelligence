import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { EMPTY_PERIOD, periodToQueryString, type Period } from "@/lib/period";

// Los dos exámenes finales gateables: Prospección (Nivel 1) y Objeciones (Nivel 2).
export type ExamKind = "prospeccion" | "objeciones";

export interface StudentSession {
  id: string;
  duration_seconds: number;
  score: number | null;
  passed: boolean | null;
  ai_feedback: string | null;
  created_at: string;
  scenario_id: string | null;
}

export interface Student {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  sessions: StudentSession[];
  totalSessions: number;
  totalDuration: number;
  averageScore: number | null;
  bestExamScore: number | null;
  examAttempts: number;
  finalGrade: number | null;
  gradedAt: string | null;
  examenFinalEnabled: boolean;
  examenObjecionesEnabled: boolean;
  level2Unlocked: boolean;
  phoneNumber: string | null;
  sedeId: string | null;
  sedeName: string | null;
  country: string | null;
  coachId: string | null;
  coachName: string | null;
  divisionId: string | null;
  divisionName: string | null;
}

interface UseStudentsReturn {
  students: Student[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  assignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  toggleExamen: (userId: string, exam: ExamKind, enabled: boolean) => Promise<boolean>;
  bulkToggleExamen: (userIds: string[], exam: ExamKind, enabled: boolean) => Promise<number | null>;
  assignCoach: (userId: string, coachId: string | null) => Promise<boolean>;
  assignDivision: (userId: string, divisionId: string | null) => Promise<boolean>;
  updateUser: (userId: string, patch: UpdateUserPatch) => Promise<boolean>;
}

// Campos editables vía el endpoint unificado PATCH /api/admin/users/:id.
export interface UpdateUserPatch {
  sedeId?: string;
  roles?: string[];
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  coachId?: string | null;
  divisionId?: string | null;
  examenFinalEnabled?: boolean;
  examenObjecionesEnabled?: boolean;
  level2Unlocked?: boolean;
  courseCompleted?: boolean;
  tutorialCompleted?: boolean;
  emailVerified?: boolean;
}

export const useStudents = (period: Period = EMPTY_PERIOD): UseStudentsReturn => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qs = periodToQueryString(period);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<any[]>(`/api/admin/students${qs}`);

      const studentsWithData: Student[] = (data || []).map((s) => ({
        id: s.id,
        email: s.email,
        first_name: s.firstName,
        last_name: s.lastName,
        created_at: s.createdAt,
        sessions: [], // Sessions are aggregated server-side
        totalSessions: s.totalSessions,
        totalDuration: s.totalDuration,
        averageScore: s.averageScore,
        bestExamScore: s.bestExamScore ?? null,
        examAttempts: s.examAttempts ?? 0,
        finalGrade: s.finalGrade,
        gradedAt: s.createdAt, // TODO: add gradeUpdatedAt to API
        examenFinalEnabled: s.examenFinalEnabled ?? false,
        examenObjecionesEnabled: s.examenObjecionesEnabled ?? false,
        level2Unlocked: s.level2Unlocked ?? false,
        phoneNumber: s.phoneNumber ?? null,
        sedeId: s.sedeId ?? null,
        sedeName: s.sedeName ?? null,
        country: s.sedeCountry ?? null,
        coachId: s.coachId ?? null,
        coachName: s.coachName ?? null,
        divisionId: s.divisionId ?? null,
        divisionName: s.divisionName ?? null,
      }));

      setStudents(studentsWithData);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err instanceof Error ? err.message : "Error loading students");
    } finally {
      setIsLoading(false);
    }
  }, [qs]);

  const assignGrade = async (
    userId: string,
    grade: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      await api.post("/api/admin/grades", {
        userId,
        finalGrade: grade,
        notes: notes || null,
      });

      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error assigning grade:", err);
      return false;
    }
  };

  const toggleExamen = async (userId: string, exam: ExamKind, enabled: boolean): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}/examen-final`, { enabled, exam });
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error toggling examen:", err);
      return false;
    }
  };

  const bulkToggleExamen = async (
    userIds: string[],
    exam: ExamKind,
    enabled: boolean,
  ): Promise<number | null> => {
    if (userIds.length === 0) return 0;
    try {
      const res = await api.patch<{ count: number }>(`/api/admin/users/bulk/examen-final`, {
        userIds,
        enabled,
        exam,
      });
      await fetchStudents();
      return res?.count ?? userIds.length;
    } catch (err) {
      console.error("Error bulk toggling examen:", err);
      return null;
    }
  };

  const assignCoach = async (userId: string, coachId: string | null): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}/coach`, { coachId });
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error assigning coach:", err);
      return false;
    }
  };

  // Asigna (o desasigna con null) la división del estudiante. El backend
  // sincroniza el coach con el coach de la división.
  const assignDivision = async (userId: string, divisionId: string | null): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}/division`, { divisionId });
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error assigning division:", err);
      return false;
    }
  };

  // Edición unificada (admin global). El backend valida coach↔sede, roles y
  // el cambio de email. Re-lanza el error para que el modal muestre el mensaje.
  const updateUser = async (userId: string, patch: UpdateUserPatch): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}`, patch);
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error updating user:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents, assignGrade, toggleExamen, bulkToggleExamen, assignCoach, assignDivision, updateUser };
};
