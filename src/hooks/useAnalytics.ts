import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface BreakdownData {
  apertura: number | null;
  escuchaActiva: number | null;
  manejoObjeciones: number | null;
  propuestaValor: number | null;
  cierre: number | null;
}

export interface ScoreHistoryEntry {
  date: string;
  score: number;
  scenarioName: string;
  breakdown: BreakdownData | null;
}

export interface ActivityEntry {
  date: string;
  count: number;
}

export interface AnalyticsData {
  scoreHistory: ScoreHistoryEntry[];
  averageBreakdown: BreakdownData | null;
  latestBreakdown: BreakdownData | null;
  activityHeatmap: ActivityEntry[];
}

export interface CompetencyEntry {
  date: string;
  score: number | null;
  apertura: number;
  escuchaActiva: number;
  manejoObjeciones: number;
  propuestaValor: number;
  cierre: number;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await api.get<AnalyticsData>('/api/analytics/dashboard');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useCompetencyHistory() {
  const [data, setData] = useState<CompetencyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await api.get<CompetencyEntry[]>('/api/analytics/competencies');
      setData(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading competency data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error };
}
