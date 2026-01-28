import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { authApi, clearTokens, getAccessToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (getAccessToken()) {
        try {
          const data = await authApi.getMe();
          setUser(data.user);
        } catch (error) {
          console.error("Auth check failed:", error);
          clearTokens();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const data = await authApi.signup(email, password, fullName);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
