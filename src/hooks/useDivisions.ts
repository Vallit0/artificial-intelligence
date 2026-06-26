import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface Division {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  sede: { id: string; slug: string; name: string } | null;
  coach: { id: string; name: string; email: string } | null;
  learnerCount: number;
}

export interface PublicDivision {
  id: string;
  name: string;
}

export interface CreateDivisionInput {
  sedeId: string;
  name: string;
  coachId?: string | null;
}

export interface UpdateDivisionInput {
  name?: string;
  isActive?: boolean;
  coachId?: string | null;
}

// Bus de mutaciones a nivel de módulo (mismo patrón que useSedes): crear/editar
// una división re-sincroniza todas las instancias del hook.
const divisionMutationListeners = new Set<() => void>();
const notifyDivisionsChanged = () => {
  divisionMutationListeners.forEach((listener) => listener());
};

export const useDivisions = (options?: { includeInactive?: boolean; enabled?: boolean }) => {
  const includeInactive = options?.includeInactive ?? false;
  const enabled = options?.enabled ?? true;
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchDivisions = useCallback(async () => {
    if (!enabled) return;
    try {
      setIsLoading(true);
      setError(null);
      const q = includeInactive ? "?includeInactive=true" : "";
      const data = await api.get<Division[]>(`/api/admin/divisions${q}`);
      setDivisions(data || []);
    } catch (err) {
      console.error("Error fetching divisions:", err);
      setError(err instanceof Error ? err.message : "Error cargando divisiones");
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive, enabled]);

  const createDivision = async (input: CreateDivisionInput): Promise<Division | null> => {
    try {
      const division = await api.post<Division>("/api/admin/divisions", input);
      notifyDivisionsChanged();
      return division;
    } catch (err) {
      console.error("Error creating division:", err);
      throw err;
    }
  };

  const updateDivision = async (id: string, input: UpdateDivisionInput): Promise<Division | null> => {
    try {
      const division = await api.patch<Division>(`/api/admin/divisions/${id}`, input);
      notifyDivisionsChanged();
      return division;
    } catch (err) {
      console.error("Error updating division:", err);
      throw err;
    }
  };

  const deleteDivision = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/divisions/${id}`);
      notifyDivisionsChanged();
      return true;
    } catch (err) {
      console.error("Error deleting division:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchDivisions();
    divisionMutationListeners.add(fetchDivisions);
    return () => {
      divisionMutationListeners.delete(fetchDivisions);
    };
  }, [fetchDivisions]);

  return { divisions, isLoading, error, refetch: fetchDivisions, createDivision, updateDivision, deleteDivision };
};

// Variante pública: lee /api/divisions?sedeId= (sin auth). Usada por el selector
// de división en el signup. Se vuelve a pedir cuando cambia la sede elegida.
export const usePublicDivisions = (sedeRef: string | null | undefined) => {
  const [divisions, setDivisions] = useState<PublicDivision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sedeRef) {
      setDivisions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.get<PublicDivision[]>(
          `/api/divisions?sedeId=${encodeURIComponent(sedeRef)}`,
        );
        if (!cancelled) setDivisions(data || []);
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching public divisions:", err);
          setError(err instanceof Error ? err.message : "Error cargando divisiones");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sedeRef]);

  return { divisions, isLoading, error };
};
