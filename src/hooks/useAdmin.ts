import { useAuth } from "@/hooks/useAuth";

interface UseAdminReturn {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAdmin = (): UseAdminReturn => {
  const { isAdmin, loading } = useAuth();

  return {
    isAdmin,
    isLoading: loading,
    error: null,
  };
};
