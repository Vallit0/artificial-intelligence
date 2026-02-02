import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UseAdminReturn {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAdmin = (): UseAdminReturn => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.email) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check if user's email is in the admin_emails table
        const { data, error: queryError } = await supabase
          .from("admin_emails")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        if (queryError) {
          console.error("Error checking admin status:", queryError);
          setError(queryError.message);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setError(err instanceof Error ? err.message : "Error checking admin status");
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user?.email]);

  return { isAdmin, isLoading, error };
};
