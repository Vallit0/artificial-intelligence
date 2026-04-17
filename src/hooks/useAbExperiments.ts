import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface AbVariant {
  id: string;
  experimentId: string;
  name: string;
  systemPrompt: string | null;
  firstMessage: string | null;
  weight: number;
}

export interface AbExperiment {
  id: string;
  name: string;
  description: string | null;
  agentSecretName: string;
  status: 'draft' | 'active' | 'completed';
  variants: AbVariant[];
  _count?: { assignments: number };
  createdAt: string;
}

export interface VariantResult {
  variantId: string;
  variantName: string;
  assignmentCount: number;
  sessionCount: number;
  avgScore: number | null;
  avgDuration: number | null;
  passRate: number;
  breakdownAvg: {
    apertura: number | null;
    escuchaActiva: number | null;
    manejoObjeciones: number | null;
    propuestaValor: number | null;
    cierre: number | null;
  };
}

export interface ExperimentResults {
  experiment: { id: string; name: string; status: string; agentSecretName: string };
  results: VariantResult[];
}

export function useAbExperiments() {
  const [experiments, setExperiments] = useState<AbExperiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<AbExperiment[]>('/api/admin/experiments');
      setExperiments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading experiments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchExperiments(); }, [fetchExperiments]);

  const createExperiment = useCallback(async (data: {
    name: string;
    description?: string;
    agentSecretName: string;
    variants: Array<{ name: string; systemPrompt?: string; firstMessage?: string; weight?: number }>;
  }) => {
    const result = await api.post<AbExperiment>('/api/admin/experiments', data);
    await fetchExperiments();
    return result;
  }, [fetchExperiments]);

  const updateExperiment = useCallback(async (id: string, data: {
    name?: string;
    description?: string;
    status?: 'draft' | 'active' | 'completed';
  }) => {
    const result = await api.put<AbExperiment>(`/api/admin/experiments/${id}`, data);
    await fetchExperiments();
    return result;
  }, [fetchExperiments]);

  const deleteExperiment = useCallback(async (id: string) => {
    await api.delete(`/api/admin/experiments/${id}`);
    await fetchExperiments();
  }, [fetchExperiments]);

  const getResults = useCallback(async (id: string): Promise<ExperimentResults> => {
    return api.get<ExperimentResults>(`/api/admin/experiments/${id}/results`);
  }, []);

  return {
    experiments,
    isLoading,
    error,
    refetch: fetchExperiments,
    createExperiment,
    updateExperiment,
    deleteExperiment,
    getResults,
  };
}
