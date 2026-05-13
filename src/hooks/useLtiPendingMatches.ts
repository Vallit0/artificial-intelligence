import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface LtiPendingMatchCandidate {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

export interface LtiPendingMatch {
  id: string;
  courseSyncId: string;
  ltiUserId: string;
  ltiEmail: string | null;
  ltiName: string | null;
  candidateUserIds: string[];
  reason: string;
  createdAt: string;
  courseSync?: { contextTitle: string | null; contextId: string };
  candidates: LtiPendingMatchCandidate[];
}

export const useLtiPendingMatches = () => {
  const [matches, setMatches] = useState<LtiPendingMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<LtiPendingMatch[]>("/api/admin/lti/pending-matches");
      setMatches(data || []);
    } catch (err) {
      console.error("Error fetching pending matches:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveMatch = async (id: string, userId: string): Promise<boolean> => {
    try {
      await api.post(`/api/admin/lti/pending-matches/${id}/resolve`, { userId });
      await fetchMatches();
      return true;
    } catch (err) {
      console.error("Error resolving match:", err);
      return false;
    }
  };

  const dismissMatch = async (id: string): Promise<boolean> => {
    try {
      await api.post(`/api/admin/lti/pending-matches/${id}/dismiss`);
      await fetchMatches();
      return true;
    } catch (err) {
      console.error("Error dismissing match:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return { matches, isLoading, resolveMatch, dismissMatch, refetch: fetchMatches };
};
