import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
}

interface UseScenariosReturn {
  scenarios: Scenario[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useScenarios = (): UseScenariosReturn => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from("scenarios")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (fetchError) throw fetchError;
      
      setScenarios(data || []);
    } catch (err) {
      console.error("Error fetching scenarios:", err);
      setError(err instanceof Error ? err.message : "Error al cargar escenarios");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
