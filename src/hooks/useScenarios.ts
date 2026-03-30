import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  objection: string;
  client_persona: string;
  first_message: string | null;
  voice_type: string;
  difficulty: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface ScenarioProgress {
  scenario_id: string;
  is_unlocked: boolean;
  is_completed: boolean;
  best_score: number | null;
  attempts: number;
}

export interface ScenarioWithProgress extends Scenario {
  progress: ScenarioProgress | null;
}

interface UseScenariosReturn {
  scenarios: ScenarioWithProgress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Map backend camelCase to frontend snake_case for compatibility
function mapApiScenario(s: any): Scenario {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    objection: s.objection,
    client_persona: s.clientPersona,
    first_message: s.firstMessage ?? null,
    voice_type: s.voiceType,
    difficulty: s.difficulty,
    is_active: s.isActive,
    display_order: s.displayOrder,
    created_at: s.createdAt,
  };
}

function mapApiProgress(p: any): ScenarioProgress {
  return {
    scenario_id: p.scenarioId,
    is_unlocked: p.isUnlocked,
    is_completed: p.isCompleted,
    best_score: p.bestScore ?? null,
    attempts: p.attempts,
  };
}

export const useScenarios = (): UseScenariosReturn => {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<ScenarioWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch scenarios from API
      const scenariosData = await api.get<any[]>("/api/scenarios");

      // Fetch user progress if authenticated
      let progressMap = new Map<string, ScenarioProgress>();

      if (user) {
        try {
          const progressData = await api.get<any[]>("/api/progress");
          if (progressData) {
            progressData.forEach((p) => {
              progressMap.set(p.scenarioId, mapApiProgress(p));
            });
          }
        } catch {
          // Progress fetch may fail if user just signed up
        }
      }

      // Combine scenarios with progress
      const scenariosWithProgress: ScenarioWithProgress[] = (scenariosData || []).map(
        (rawScenario, index: number) => {
          const scenario = mapApiScenario(rawScenario);
          const progress = progressMap.get(scenario.id) || null;

          const isFirstScenario = index === 0;
          const defaultUnlocked = isFirstScenario || !user;

          return {
            ...scenario,
            display_order: scenario.display_order ?? index,
            progress: progress || (user ? {
              scenario_id: scenario.id,
              is_unlocked: defaultUnlocked,
              is_completed: false,
              best_score: null,
              attempts: 0,
            } : null),
          };
        }
      );

      setScenarios(scenariosWithProgress);
    } catch (err) {
      console.error("Error fetching scenarios:", err);
      setError(err instanceof Error ? err.message : "Error al cargar escenarios");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return {
    scenarios,
    isLoading,
    error,
    refetch: fetchScenarios,
  };
};
