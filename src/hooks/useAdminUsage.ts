import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ActivityEntry } from './useAnalytics';

export interface SedeUsage {
  sedeId: string;
  sedeName: string;
  totalTimeSeconds: number;
  totalSessions: number;
  activeStudents: number;
  totalStudents: number;
}

export interface UsageTotals {
  totalTimeSeconds: number;
  totalSessions: number;
  activeStudents: number;
  totalStudents: number;
}

export interface AdminUsageData {
  totals: UsageTotals;
  bySede: SedeUsage[];
  activityTrend: ActivityEntry[];
}

export function useAdminUsage() {
  const [data, setData] = useState<AdminUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await api.get<AdminUsageData>('/api/admin/analytics/usage');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading usage analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
