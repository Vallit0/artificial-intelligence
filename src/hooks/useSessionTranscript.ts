import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface TranscriptMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
}

export interface SessionTranscriptData {
  transcript: TranscriptMessage[] | null;
  score: number | null;
  passed: boolean;
  aiFeedback: string | null;
  durationSeconds: number;
  createdAt: string;
  scenarioName: string | null;
  breakdown: {
    apertura: number;
    escuchaActiva: number;
    manejoObjeciones: number;
    propuestaValor: number;
    cierre: number;
  } | null;
  summary: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendation: string | null;
  } | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export function useSessionTranscript() {
  const [data, setData] = useState<SessionTranscriptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = useCallback(async (sessionId: string, isAdmin = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const endpoint = isAdmin
        ? `/api/admin/sessions/${sessionId}/transcript`
        : `/api/sessions/${sessionId}/transcript`;
      const result = await api.get<SessionTranscriptData>(endpoint);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading transcript');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, fetchTranscript, clear };
}
