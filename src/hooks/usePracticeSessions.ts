import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PracticeSession {
  id: string;
  user_id: string;
  duration_seconds: number;
  rating: number | null;
  created_at: string;
}

interface UsePracticeSessionsReturn {
  sessions: PracticeSession[];
  totalPracticeTime: number;
  isLoading: boolean;
  savePracticeSession: (durationSeconds: number, rating?: number, scenarioId?: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const usePracticeSessions = (): UsePracticeSessionsReturn => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("practice_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching practice sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const savePracticeSession = useCallback(
    async (durationSeconds: number, rating?: number, scenarioId?: string) => {
      if (!user) return;

      try {
        const { error } = await supabase.from("practice_sessions").insert({
          user_id: user.id,
          duration_seconds: durationSeconds,
          rating: rating ?? null,
          scenario_id: scenarioId ?? null,
        });

        if (error) throw error;
        await fetchSessions();
      } catch (error) {
        console.error("Error saving practice session:", error);
      }
    },
    [user, fetchSessions]
  );

  const totalPracticeTime = sessions.reduce(
    (acc, session) => acc + session.duration_seconds,
    0
  );

  return {
    sessions,
    totalPracticeTime,
    isLoading,
    savePracticeSession,
    refetch: fetchSessions,
  };
};
