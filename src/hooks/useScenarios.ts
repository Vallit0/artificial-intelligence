import { useState, useEffect, useCallback } from "react";
import { scenariosApi, progressApi } from "@/lib/api";
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

export const useScenarios = (): UseScenariosReturn => {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<ScenarioWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch scenarios
      const scenariosData = await scenariosApi.getAll();

      // Fetch user progress if authenticated
      let progressMap = new Map<string, ScenarioProgress>();
      
      if (user) {
        try {
          const progressData = await progressApi.getMyProgress();
          if (progressData) {
            progressData.forEach((p: ScenarioProgress) => {
              progressMap.set(p.scenario_id, p);
            });
          }
        } catch (e) {
          console.warn("Could not fetch progress:", e);
        }
      }

      // Combine scenarios with progress
      const scenariosWithProgress: ScenarioWithProgress[] = (scenariosData || []).map(
        (scenario: Scenario, index: number) => {
          const progress = progressMap.get(scenario.id) || null;
          
          // First scenario is always unlocked, others depend on progress
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
