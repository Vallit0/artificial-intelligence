import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { api, ApiUser } from "@/lib/api-client";
import { DEMO, DEMO_USER, DEMO_ROLES } from "@/lib/demoMode";

interface AuthContextType {
  user: ApiUser | null;
  loading: boolean;
  isAdmin: boolean;
  roles: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    sede: string,
    divisionId: string | undefined,
    firstName?: string,
    lastName?: string,
    phoneNumber?: string,
  ) => Promise<{ status: string; message?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (patch: Partial<ApiUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  // El toggle `canAccessAdmin` de un coach le da acceso al panel admin global
  // (atraviesa sedes, como un admin), así que lo tratamos como admin en la UI.
  const isAdmin = roles.includes("admin") || !!user?.coachPermissions?.canAccessAdmin;

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      // Modo demo (/intro con ?demo=1): sesión admin/coach falsa, sin backend.
      if (DEMO) {
        setUser(DEMO_USER);
        setRoles(DEMO_ROLES);
        setLoading(false);
        return;
      }

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

    // Fetch roles + perfil enriquecido (sede/coach sólo vienen en /auth/me).
    const meData = await api.get<{ user: ApiUser; roles: string[] }>("/auth/me");
    setUser(meData.user);
    setRoles(meData.roles);
  }, []);

  // Auto-registro con aprobación: el backend ya NO emite tokens. El usuario
  // queda en estado `pending` hasta que un admin/coach lo apruebe, así que
  // acá no seteamos sesión — sólo devolvemos el estado para que la UI muestre
  // la pantalla de "pendiente de aprobación".
  const signUp = useCallback(async (
    email: string,
    password: string,
    sede: string,
    divisionId: string | undefined,
    firstName?: string,
    lastName?: string,
    phoneNumber?: string,
  ) => {
    const data = await api.post<{ status: string; email: string; message?: string }>(
      "/auth/signup",
      { email, password, sede, divisionId, firstName, lastName, phoneNumber },
    );
    return { status: data.status, message: data.message };
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
