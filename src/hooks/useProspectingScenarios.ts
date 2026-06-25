import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface ProspectingScenarioConfig {
  id: string;
  secretName: string;
  label: string | null;
  description: string | null;
  videoUrl: string | null;
  location: string | null;
  targetAge: string | null;
  systemPrompt: string | null;
  firstMessage: string | null;
  isActiveGlobal: boolean;
  builderParams?: unknown | null;
}

// Override de presentación del carrusel para un escenario (campos que el alumno
// ve). Cualquier campo null cae al valor por defecto definido en código.
export interface ProspectingDisplayOverride {
  secretName: string;
  label: string | null;
  description: string | null;
  videoUrl: string | null;
  location: string | null;
  targetAge: string | null;
}

export interface UserScenarioAccessEntry {
  id: string;
  userId: string;
  secretName: string;
  enabled: boolean;
}

// Admin: list + update prospecting scenario configs (prompts + global visibility)
export const useProspectingScenarioConfigs = () => {
  const [configs, setConfigs] = useState<ProspectingScenarioConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<ProspectingScenarioConfig[]>("/api/admin/prospecting-scenarios");
      setConfigs(data || []);
    } catch (err) {
      console.error("Error fetching prospecting scenarios:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConfig = async (secretName: string, patch: Partial<Omit<ProspectingScenarioConfig, "id" | "secretName">>): Promise<boolean> => {
    try {
      await api.put("/api/admin/prospecting-scenarios", { secretName, ...patch });
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error("Error saving prospecting scenario:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return { configs, isLoading, saveConfig, refetch: fetchConfigs };
};

// Admin: per-user scenario access matrix
export const useUserScenarioAccess = (userId: string | null) => {
  const [access, setAccess] = useState<UserScenarioAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAccess = useCallback(async () => {
    if (!userId) {
      setAccess([]);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.get<UserScenarioAccessEntry[]>(`/api/admin/user-scenario-access/${userId}`);
      setAccess(data || []);
    } catch (err) {
      console.error("Error fetching user scenario access:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const saveAccess = async (entries: Array<{ secretName: string; enabled: boolean }>): Promise<boolean> => {
    if (!userId) return false;
    try {
      await api.put(`/api/admin/user-scenario-access/${userId}`, { entries });
      await fetchAccess();
      return true;
    } catch (err) {
      console.error("Error saving user scenario access:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return { access, isLoading, saveAccess, refetch: fetchAccess };
};

// Learner: visible scenarios for current user, plus per-scenario display
// overrides (nombre/descripción/video) que el carrusel fusiona sobre los
// valores por defecto en código.
export const useMyVisibleScenarios = () => {
  const [visible, setVisible] = useState<Set<string> | null>(null);
  const [overrides, setOverrides] = useState<Map<string, ProspectingDisplayOverride>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ visible: string[]; overrides?: ProspectingDisplayOverride[] }>(
          "/api/prospecting-scenarios/me"
        );
        if (!cancelled) {
          setVisible(new Set(data?.visible || []));
          setOverrides(new Map((data?.overrides || []).map((o) => [o.secretName, o])));
        }
      } catch (err) {
        console.error("Error fetching visible scenarios:", err);
        if (!cancelled) setVisible(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { visible, overrides, isLoading };
};
