import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface LtiPlatform {
  id: string;
  name: string;
  issuerUrl: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  deploymentId: string;
  isActive: boolean;
  createdAt: string;
}

export const useLtiPlatforms = () => {
  const [platforms, setPlatforms] = useState<LtiPlatform[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlatforms = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<LtiPlatform[]>("/api/admin/lti-platforms");
      setPlatforms(data || []);
    } catch (err) {
      console.error("Error fetching LTI platforms:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPlatform = async (data: Omit<LtiPlatform, "id" | "isActive" | "createdAt">): Promise<boolean> => {
    try {
      await api.post("/api/admin/lti-platforms", data);
      await fetchPlatforms();
      return true;
    } catch (err) {
      console.error("Error creating LTI platform:", err);
      return false;
    }
  };

  const updatePlatform = async (id: string, data: Partial<LtiPlatform>): Promise<boolean> => {
    try {
      await api.put(`/api/admin/lti-platforms/${id}`, data);
      await fetchPlatforms();
      return true;
    } catch (err) {
      console.error("Error updating LTI platform:", err);
      return false;
    }
  };

  const deletePlatform = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/lti-platforms/${id}`);
      await fetchPlatforms();
      return true;
    } catch (err) {
      console.error("Error deleting LTI platform:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  return { platforms, isLoading, createPlatform, updatePlatform, deletePlatform, refetch: fetchPlatforms };
};
