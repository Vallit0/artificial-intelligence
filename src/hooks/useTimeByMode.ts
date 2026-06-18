import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { TimeByMode } from "@/lib/time-by-mode";
import { EMPTY_PERIOD, periodToQueryString, type Period } from "@/lib/period";

// Desglose de tiempo por modo para admin/coach. El backend ya agrega y aplica el
// alcance: admin global ve todo; un coach ve sólo sus alumnos asignados.
export interface StudentTimeByMode extends TimeByMode {
  id: string;
  name: string;
}

export interface TimeByModeData {
  totals: TimeByMode;
  byStudent: StudentTimeByMode[];
}

export function useTimeByMode(period: Period = EMPTY_PERIOD) {
  const [data, setData] = useState<TimeByModeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qs = periodToQueryString(period);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await api.get<TimeByModeData>(`/api/admin/analytics/time-by-mode${qs}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading time-by-mode analytics");
    } finally {
      setIsLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
