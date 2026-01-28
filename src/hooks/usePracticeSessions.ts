import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PracticeSession {
  id: string;
  user_id: string;
  duration_seconds: number;
  rating: number | null;
  score: number | null;
  passed: boolean;
  ai_feedback: string | null;
  scenario_id: string | null;
  created_at: string;
}

interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  breakdown?: {
    apertura: number;
    escucha_activa: number;
    manejo_objeciones: number;
    propuesta_valor: number;
    cierre: number;
  };
}

interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

interface UsePracticeSessionsReturn {
  sessions: PracticeSession[];
  totalPracticeTime: number;
  isLoading: boolean;
  isEvaluating: boolean;
  lastEvaluation: EvaluationResult | null;
  savePracticeSession: (
    durationSeconds: number, 
    rating?: number, 
    scenarioId?: string
  ) => Promise<string | null>;
  evaluateSession: (
    sessionId: string,
    transcript: TranscriptMessage[],
    scenarioId: string | null,
    durationSeconds: number
  ) => Promise<EvaluationResult | null>;
  refetch: () => Promise<void>;
}

export const usePracticeSessions = (): UsePracticeSessionsReturn => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null);

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
    async (durationSeconds: number, rating?: number, scenarioId?: string): Promise<string | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("practice_sessions")
          .insert({
            user_id: user.id,
            duration_seconds: durationSeconds,
            rating: rating ?? null,
            scenario_id: scenarioId ?? null,
          })
          .select("id")
          .single();

        if (error) throw error;
        return data?.id || null;
      } catch (error) {
        console.error("Error saving practice session:", error);
        return null;
      }
    },
    [user]
  );

  const evaluateSession = useCallback(
    async (
      sessionId: string,
      transcript: TranscriptMessage[],
      scenarioId: string | null,
      durationSeconds: number
    ): Promise<EvaluationResult | null> => {
      if (!user) return null;

      setIsEvaluating(true);
      setLastEvaluation(null);

      try {
        const { data, error } = await supabase.functions.invoke("evaluate-session", {
          body: {
            transcript,
            scenario_id: scenarioId,
            session_id: sessionId,
            duration_seconds: durationSeconds,
          },
        });

        if (error) throw error;

        const evaluation: EvaluationResult = {
          score: data.score,
          passed: data.passed,
          feedback: data.feedback,
          breakdown: data.breakdown,
        };

        setLastEvaluation(evaluation);
        await fetchSessions();
        
        return evaluation;
      } catch (error) {
        console.error("Error evaluating session:", error);
        return null;
      } finally {
        setIsEvaluating(false);
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
    isEvaluating,
    lastEvaluation,
    savePracticeSession,
    evaluateSession,
    refetch: fetchSessions,
  };
};
