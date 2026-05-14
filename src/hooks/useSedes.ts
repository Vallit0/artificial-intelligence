import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface Sede {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSede {
  id: string;
  slug: string;
  name: string;
  country: string | null;
}

export interface CreateSedeInput {
  slug: string;
  name: string;
  country?: string;
  city?: string;
  address?: string;
}

export interface UpdateSedeInput {
  slug?: string;
  name?: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export const useSedes = (options?: { includeInactive?: boolean }) => {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const includeInactive = options?.includeInactive ?? false;

  const fetchSedes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const q = includeInactive ? "?includeInactive=true" : "";
      const data = await api.get<Sede[]>(`/api/admin/sedes${q}`);
      setSedes(data || []);
    } catch (err) {
      console.error("Error fetching sedes:", err);
      setError(err instanceof Error ? err.message : "Error cargando sedes");
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  const createSede = async (input: CreateSedeInput): Promise<Sede | null> => {
    try {
      const sede = await api.post<Sede>("/api/admin/sedes", input);
      await fetchSedes();
      return sede;
    } catch (err) {
      console.error("Error creating sede:", err);
      throw err;
    }
  };

  const updateSede = async (id: string, input: UpdateSedeInput): Promise<Sede | null> => {
    try {
      const sede = await api.patch<Sede>(`/api/admin/sedes/${id}`, input);
      await fetchSedes();
      return sede;
    } catch (err) {
      console.error("Error updating sede:", err);
      throw err;
    }
  };

  const deleteSede = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/sedes/${id}`);
      await fetchSedes();
      return true;
    } catch (err) {
      console.error("Error deleting sede:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchSedes();
  }, [fetchSedes]);

  return { sedes, isLoading, error, refetch: fetchSedes, createSede, updateSede, deleteSede };
};

// Variante pública: sólo lee /api/sedes (sin auth). Usada por el selector
// de sede en el signup, donde el usuario todavía no tiene sesión.
export const usePublicSedes = () => {
  const [sedes, setSedes] = useState<PublicSede[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await api.get<PublicSede[]>("/api/sedes");
        if (!cancelled) setSedes(data || []);
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching public sedes:", err);
          setError(err instanceof Error ? err.message : "Error cargando sedes");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sedes, isLoading, error };
};
