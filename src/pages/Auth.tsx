import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { X } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: validation.error.errors[0].message,
      });
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "¡Bienvenido!", description: "Sesión iniciada correctamente" });
        navigate("/scenarios");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "¡Cuenta creada!",
          description: "Ya puedes iniciar sesión",
        });
        setIsLogin(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        variant: "destructive",
        title: "Error",
        description: message.includes("already registered")
          ? "Este email ya está registrado"
          : message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLogin(!isLogin)}
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold uppercase tracking-wider"
        >
          {isLogin ? "Registrarse" : "Iniciar Sesión"}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground text-center mb-8">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type="email"
                placeholder="Email o usuario"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 bg-card border-2 border-border rounded-2xl px-4 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="relative">
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-14 bg-card border-2 border-border rounded-2xl px-4 pr-24 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
              {isLogin && (
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-wider"
                >
                  ¿Olvidaste?
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider shadow-[0_4px_0_0_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)] hover:translate-y-[2px] transition-all"
            >
              {loading
                ? "Cargando..."
                : isLogin
                ? "Iniciar Sesión"
                : "Registrarse"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-muted px-4 text-sm text-muted-foreground uppercase tracking-wider">
                o
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-2xl border-2 border-border bg-card hover:bg-accent font-bold uppercase tracking-wider"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Al iniciar sesión aceptas nuestros{" "}
            <a href="#" className="text-primary hover:underline">
              Términos
            </a>{" "}
            y{" "}
            <a href="#" className="text-primary hover:underline">
              Política de Privacidad
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
