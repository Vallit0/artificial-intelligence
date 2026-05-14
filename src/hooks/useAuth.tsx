import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { api, ApiUser } from "@/lib/api-client";

interface AuthContextType {
  user: ApiUser | null;
  loading: boolean;
  isAdmin: boolean;
  roles: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, sede: string, firstName?: string, lastName?: string, phoneNumber?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (patch: Partial<ApiUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const isAdmin = roles.includes("admin");

  // Check for tokens in URL (LTI redirect flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      api.setTokens(accessToken, refreshToken);
      // Strip ONLY the auth tokens; keep other query params (e.g.
      // ?scenario=... set by an LTI deep-linked resource launch) so the
      // landing page can still react to them.
      params.delete("access_token");
      params.delete("refresh_token");
      const remaining = params.toString();
      const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : "");
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      if (!api.hasTokens()) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.get<{ user: ApiUser; roles: string[] }>("/auth/me");
        setUser(data.user);
        setRoles(data.roles);
      } catch {
        api.clearTokens();
        setUser(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  // Listen for auth state changes (e.g., token expiry)
  useEffect(() => {
    return api.onAuthChange((newUser) => {
      if (!newUser) {
        setUser(null);
        setRoles([]);
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post<{
      user: ApiUser;
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", { email, password });

    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);

    // Fetch roles
    const meData = await api.get<{ user: ApiUser; roles: string[] }>("/auth/me");
    setRoles(meData.roles);
  }, []);

  const signUp = useCallback(async (email: string, password: string, sede: string, firstName?: string, lastName?: string, phoneNumber?: string) => {
    const data = await api.post<{
      user: ApiUser;
      accessToken: string;
      refreshToken: string;
    }>("/auth/signup", { email, password, sede, firstName, lastName, phoneNumber });

    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setRoles(["learner"]);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!api.hasTokens()) return;
    try {
      const data = await api.get<{ user: ApiUser; roles: string[] }>("/auth/me");
      setUser(data.user);
      setRoles(data.roles);
    } catch (err) {
      console.warn("refreshUser failed:", err);
    }
  }, []);

  // Locally merge a partial update into the cached user. Used after mutations
  // (e.g., unlock-level2) where awaiting a /auth/me round-trip is fragile —
  // an ETag/304 can return a stale body and leave the sidebar pinned to the
  // pre-mutation level even though the DB row is up to date.
  const patchUser = useCallback((patch: Partial<ApiUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout", { refreshToken: localStorage.getItem("refresh_token") });
    } catch (error) {
      console.warn("SignOut error (session may have expired):", error);
    }
    api.clearTokens();
    setUser(null);
    setRoles([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, roles, signIn, signUp, signOut, refreshUser, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
