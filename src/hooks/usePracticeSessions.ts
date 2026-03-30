import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
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

function mapApiSession(s: any): PracticeSession {
  return {
    id: s.id,
    user_id: s.userId,
    duration_seconds: s.durationSeconds,
    rating: s.rating ?? null,
    score: s.score ?? null,
    passed: s.passed,
    ai_feedback: s.aiFeedback ?? null,
    scenario_id: s.scenarioId ?? null,
    created_at: s.createdAt,
  };
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
      const data = await api.get<any[]>("/api/sessions");
      setSessions((data || []).map(mapApiSession));
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
        const data = await api.post<any>("/api/sessions", {
          durationSeconds,
          rating: rating || null,
          scenarioId: scenarioId || null,
        });
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
        const data = await api.post<EvaluationResult>("/api/sessions/evaluate", {
          sessionId,
          transcript,
          scenarioId,
          durationSeconds,
        });

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
