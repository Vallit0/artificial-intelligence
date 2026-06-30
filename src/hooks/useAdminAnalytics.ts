import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { appendDivision } from '@/lib/period';
import type { BreakdownData, ActivityEntry } from './useAnalytics';

export interface StudentStat {
  id: string;
  name: string;
  totalSessions: number;
  avgScore: number;
  avgBreakdown: BreakdownData | null;
}

export interface AdminAnalyticsData {
  overallBreakdown: BreakdownData | null;
  studentStats: StudentStat[];
  activityTrend: ActivityEntry[];
}

export function useAdminAnalytics(divisionId: string | null = null) {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = `/api/admin/analytics${appendDivision('', divisionId)}`;
      const result = await api.get<AdminAnalyticsData>(url);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading admin analytics');
    } finally {
      setIsLoading(false);
    }
  }, [divisionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
