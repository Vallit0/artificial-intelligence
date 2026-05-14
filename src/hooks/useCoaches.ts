import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface CoachPermissions {
  canCreateCoaches: boolean;
  canEditPrompts: boolean;
  grantedBy: string | null;
  updatedAt: string | null;
}

export interface Coach {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  sede: {
    id: string;
    slug: string;
    name: string;
  } | null;
  permissions: CoachPermissions;
}

export interface UpdateCoachPermissionsInput {
  canCreateCoaches?: boolean;
  canEditPrompts?: boolean;
}

export const useCoaches = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoaches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<Coach[]>("/api/admin/coaches");
      setCoaches(data || []);
    } catch (err) {
      console.error("Error fetching coaches:", err);
      setError(err instanceof Error ? err.message : "Error cargando coaches");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePermissions = async (
    coachId: string,
    input: UpdateCoachPermissionsInput,
  ): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/coaches/${coachId}/permissions`, input);
      await fetchCoaches();
      return true;
    } catch (err) {
      console.error("Error updating coach permissions:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  return { coaches, isLoading, error, refetch: fetchCoaches, updatePermissions };
};
