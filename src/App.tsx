import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Scenarios from "./pages/Scenarios";
import Practice from "./pages/Practice";
import Progress from "./pages/Progress";
import ExamenFinal from "./pages/ExamenFinal";
import Auth from "./pages/Auth";
import Prospecting from "./pages/Prospecting";
import Admin from "./pages/Admin";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/scenarios" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    {/* Public landing page */}
    <Route path="/" element={<Landing />} />
    
    {/* Practice can be accessed by anyone (free tier) or authenticated users */}
    <Route path="/practice" element={<Practice />} />
    
    {/* Prospecting scenarios - requires authentication */}
    <Route
      path="/prospecting"
      element={
        <ProtectedRoute>
          <Prospecting />
        </ProtectedRoute>
      }
    />
    
    {/* Protected routes */}
    <Route
      path="/scenarios"
      element={
        <ProtectedRoute>
          <Scenarios />
        </ProtectedRoute>
      }
    />
    <Route
      path="/progress"
      element={
        <ProtectedRoute>
          <Progress />
        </ProtectedRoute>
      }
    />
    <Route
      path="/quests"
      element={
        <ProtectedRoute>
          <ExamenFinal />
        </ProtectedRoute>
      }
    />
    
    {/* Auth routes */}
    <Route
      path="/auth"
      element={
        <PublicRoute>
          <Auth />
        </PublicRoute>
      }
    />
    
    {/* Password reset route */}
    <Route path="/reset-password" element={<ResetPassword />} />
    
    {/* Admin route - protected by admin check inside the component */}
    <Route path="/admin" element={<Admin />} />
    
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
