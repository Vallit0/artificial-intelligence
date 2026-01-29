import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      
      // Fetch scenarios from Supabase
      const { data: scenariosData, error: scenariosError } = await supabase
        .from("scenarios")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (scenariosError) throw scenariosError;

      // Fetch user progress if authenticated
      let progressMap = new Map<string, ScenarioProgress>();
      
      if (user) {
        const { data: progressData } = await supabase
          .from("user_scenario_progress")
          .select("*")
          .eq("user_id", user.id);
        
        if (progressData) {
          progressData.forEach((p) => {
            progressMap.set(p.scenario_id, {
              scenario_id: p.scenario_id,
              is_unlocked: p.is_unlocked,
              is_completed: p.is_completed,
              best_score: p.best_score,
              attempts: p.attempts,
            });
          });
        }
      }

      // Combine scenarios with progress
      const scenariosWithProgress: ScenarioWithProgress[] = (scenariosData || []).map(
        (scenario, index: number) => {
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
