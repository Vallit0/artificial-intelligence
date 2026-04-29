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
}

interface UseStudentsReturn {
  students: Student[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  assignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
  toggleExamenFinal: (userId: string, enabled: boolean) => Promise<boolean>;
  toggleLevel2: (userId: string, unlocked: boolean) => Promise<boolean>;
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

  const toggleLevel2 = async (userId: string, unlocked: boolean): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/users/${userId}/level2-unlock`, { unlocked });
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error toggling level 2:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents, assignGrade, toggleExamenFinal, toggleLevel2 };
};
