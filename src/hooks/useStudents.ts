import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  full_name: string | null;
  created_at: string;
  sessions: StudentSession[];
  totalSessions: number;
  totalDuration: number;
  averageScore: number | null;
  finalGrade: number | null;
  gradedAt: string | null;
}

interface UseStudentsReturn {
  students: Student[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  assignGrade: (userId: string, grade: number, notes?: string) => Promise<boolean>;
}

export const useStudents = (): UseStudentsReturn => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all profiles (admins can read all profiles via RLS)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      console.log("Fetched profiles:", profiles?.length || 0);

      // Fetch all practice sessions using service role through RPC or just get what we can
      // Since admin might not have access to all sessions, we need to handle this
      const { data: sessions, error: sessionsError } = await supabase
        .from("practice_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
        // Don't throw - we can still show students without sessions
      }

      console.log("Fetched sessions:", sessions?.length || 0);

      // Fetch all grades (admin has access via RLS)
      const { data: grades, error: gradesError } = await supabase
        .from("student_grades")
        .select("*");

      if (gradesError) {
        console.error("Error fetching grades:", gradesError);
        // Don't throw - we can still show students without grades
      }

      console.log("Fetched grades:", grades?.length || 0);

      // Map profiles with their sessions and grades
      const studentsWithData: Student[] = (profiles || []).map((profile) => {
        const userSessions = (sessions || []).filter(
          (s) => s.user_id === profile.id
        );
        const userGrade = (grades || []).find((g) => g.user_id === profile.id);

        const totalDuration = userSessions.reduce(
          (sum, s) => sum + (s.duration_seconds || 0),
          0
        );
        const scoredSessions = userSessions.filter((s) => s.score !== null);
        const averageScore =
          scoredSessions.length > 0
            ? scoredSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
              scoredSessions.length
            : null;

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          created_at: profile.created_at,
          sessions: userSessions.map((s) => ({
            id: s.id,
            duration_seconds: s.duration_seconds,
            score: s.score,
            passed: s.passed,
            ai_feedback: s.ai_feedback,
            created_at: s.created_at,
            scenario_id: s.scenario_id,
          })),
          totalSessions: userSessions.length,
          totalDuration,
          averageScore,
          finalGrade: userGrade ? Number(userGrade.final_grade) : null,
          gradedAt: userGrade?.created_at || null,
        };
      });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert the grade
      const { error: upsertError } = await supabase
        .from("student_grades")
        .upsert(
          {
            user_id: userId,
            graded_by: user.id,
            final_grade: grade,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) throw upsertError;

      // Refetch students to update the UI
      await fetchStudents();
      return true;
    } catch (err) {
      console.error("Error assigning grade:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents, assignGrade };
};
