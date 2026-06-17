import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface PendingUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  createdAt: string;
  sedeId: string | null;
  sedeName: string | null;
  coachId: string | null;
  coachName: string | null;
}

// Bandeja de aprobación de auto-registros. El backend filtra por sede:
// admin global ve todas, un coach ve sólo las de su sede.
export const usePendingUsers = () => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<PendingUser[]>("/api/admin/users/pending");
      setPending(data || []);
    } catch (err) {
      console.error("Error fetching pending users:", err);
      setError(err instanceof Error ? err.message : "Error cargando pendientes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const decide = useCallback(
    async (userId: string, decision: "approve" | "reject", reason?: string): Promise<boolean> => {
      try {
        await api.patch(`/api/admin/users/${userId}/approval`, { decision, reason });
        await fetchPending();
        return true;
      } catch (err) {
        console.error("Error processing approval:", err);
        throw err;
      }
    },
    [fetchPending],
  );

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return { pending, isLoading, error, refetch: fetchPending, decide };
};
