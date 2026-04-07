import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface AgentConfig {
  id?: string;
  secretName: string;
  agentId: string;
  label: string | null;
  isActive?: boolean;
}

export const useAgentConfigs = () => {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<AgentConfig[]>("/api/admin/agent-configs");
      setConfigs(data || []);
    } catch (err) {
      console.error("Error fetching agent configs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConfig = async (secretName: string, agentId: string, label?: string): Promise<boolean> => {
    try {
      await api.put("/api/admin/agent-configs", { secretName, agentId, label });
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error("Error saving agent config:", err);
      return false;
    }
  };

  const deleteConfig = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/agent-configs/${id}`);
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error("Error deleting agent config:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return { configs, isLoading, saveConfig, deleteConfig, refetch: fetchConfigs };
};
