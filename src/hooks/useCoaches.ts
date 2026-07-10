import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface CoachPermissions {
  canCreateCoaches: boolean;
  canEditPrompts: boolean;
  canAccessAdmin: boolean;
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
  canAccessAdmin?: boolean;
}

export const coachDisplayName = (c: Pick<Coach, "firstName" | "lastName" | "email">): string =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;

export const useCoaches = (enabled = true) => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchCoaches = useCallback(async () => {
    if (!enabled) return;
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
  }, [enabled]);

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

  // Borra al coach. Usa el mismo endpoint DELETE de usuarios (admin global).
  // A nivel DB, los learners asignados y las divisiones quedan con coachId en
  // null (onDelete: SetNull). Re-lanza el error para que el confirm dialog lo
  // muestre.
  const deleteCoach = async (coachId: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/users/${coachId}`);
      await fetchCoaches();
      return true;
    } catch (err) {
      console.error("Error deleting coach:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  return { coaches, isLoading, error, refetch: fetchCoaches, updatePermissions, deleteCoach };
};
