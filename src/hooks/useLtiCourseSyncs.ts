import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface LtiCourseSync {
  id: string;
  platformId: string;
  contextId: string;
  contextTitle: string | null;
  membershipsUrl: string;
  lineitemUrl: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  platform?: { name: string; issuerUrl: string };
}

export interface SyncCourseResult {
  courseSyncId: string;
  membersFetched: number;
  matched: number;
  created: number;
  pending: number;
  skipped: number;
  errors: number;
}

export interface SyncAllResult {
  startedAt: string;
  finishedAt: string;
  coursesProcessed: number;
  coursesSucceeded: number;
  coursesFailed: number;
}

export const useLtiCourseSyncs = () => {
  const [courses, setCourses] = useState<LtiCourseSync[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<LtiCourseSync[]>("/api/admin/lti/courses");
      setCourses(data || []);
    } catch (err) {
      console.error("Error fetching LTI courses:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCourse = async (data: {
    platformId: string;
    contextId: string;
    contextTitle?: string;
    membershipsUrl: string;
    lineitemUrl?: string;
  }): Promise<boolean> => {
    try {
      await api.post("/api/admin/lti/courses", data);
      await fetchCourses();
      return true;
    } catch (err) {
      console.error("Error creating LTI course:", err);
      return false;
    }
  };

  const updateCourse = async (
    id: string,
    data: Partial<Pick<LtiCourseSync, "contextTitle" | "membershipsUrl" | "lineitemUrl" | "isActive">>,
  ): Promise<boolean> => {
    try {
      await api.patch(`/api/admin/lti/courses/${id}`, data);
      await fetchCourses();
      return true;
    } catch (err) {
      console.error("Error updating LTI course:", err);
      return false;
    }
  };

  const deleteCourse = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/admin/lti/courses/${id}`);
      await fetchCourses();
      return true;
    } catch (err) {
      console.error("Error deleting LTI course:", err);
      return false;
    }
  };

  const syncCourse = async (id: string): Promise<SyncCourseResult | null> => {
    try {
      const res = await api.post<{ success: boolean; result: SyncCourseResult }>(
        `/api/admin/lti/courses/${id}/sync`,
      );
      await fetchCourses();
      return res.result;
    } catch (err) {
      console.error("Error syncing course:", err);
      return null;
    }
  };

  const syncAll = async (): Promise<SyncAllResult | null> => {
    try {
      const res = await api.post<{ success: boolean; result: SyncAllResult }>(
        `/api/admin/lti/sync-all`,
      );
      await fetchCourses();
      return res.result;
    } catch (err) {
      console.error("Error syncing all courses:", err);
      return null;
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    isLoading,
    createCourse,
    updateCourse,
    deleteCourse,
    syncCourse,
    syncAll,
    refetch: fetchCourses,
  };
};
