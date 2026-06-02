import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

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
  level2Unlocked: boolean;
  phoneNumber: string | null;
  sedeId: string | null;
  sedeName: string | null;
  coachId: string | null;
  coachName: string | null;
}

interface UseStudentsReturn {
  students: Student[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  assignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  toggleExamenFinal: (userId: string, enabled: boolean) => Promise<boolean>;
  bulkToggleExamenFinal: (userIds: string[], enabled: boolean) => Promise<number | null>;
  assignCoach: (userId: string, coachId: string | null) => Promise<boolean>;
}

export const useStudents = (): UseStudentsReturn => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<any[]>("/api/admin/students");

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
        level2Unlocked: s.level2Unlocked ?? false,
        phoneNumber: s.phoneNumber ?? null,
        sedeId: s.sedeId ?? null,
        sedeName: s.sedeName ?? null,
        coachId: s.coachId ?? null,
        coachName: s.coachName ?? null,
      }));

      setStudents(studentsWithData);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err instanceof Error ? err.message : "Error loading students");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const toggleExamenFinal = async (userId: string, enabled: boolean): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}/examen-final`, { enabled });
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error toggling examen final:", err);
      return false;
    }
  };

  const bulkToggleExamenFinal = async (userIds: string[], enabled: boolean): Promise<number | null> => {
    if (userIds.length === 0) return 0;
    try {
      const res = await api.patch<{ count: number }>(`/api/admin/users/bulk/examen-final`, { userIds, enabled });
      await fetchStudents();
      return res?.count ?? userIds.length;
    } catch (err) {
      console.error("Error bulk toggling examen final:", err);
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

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents, assignGrade, toggleExamenFinal, bulkToggleExamenFinal, assignCoach };
};
