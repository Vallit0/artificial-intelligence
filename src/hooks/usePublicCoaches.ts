import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

export interface PublicCoach {
  id: string;
  name: string;
}

// Lista pública de coaches de una sede — usada por el selector de coach en el
// signup, donde el usuario todavía no tiene sesión. Se re-pide cada vez que
// cambia la sede seleccionada. Si no hay sede, devuelve lista vacía sin pegarle
// al backend.
export const usePublicCoaches = (sedeId: string | undefined) => {
  const [coaches, setCoaches] = useState<PublicCoach[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sedeId) {
      setCoaches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.get<PublicCoach[]>(`/api/coaches?sedeId=${encodeURIComponent(sedeId)}`);
        if (!cancelled) setCoaches(data || []);
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching public coaches:", err);
          setError(err instanceof Error ? err.message : "Error cargando coaches");
          setCoaches([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sedeId]);

  return { coaches, isLoading, error };
};
