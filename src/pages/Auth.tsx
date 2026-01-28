import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

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
        await signIn(email, password);
        toast({ title: "¡Bienvenido!", description: "Sesión iniciada correctamente" });
        navigate("/scenarios");
      } else {
        await signUp(email, password, fullName || undefined);
        toast({
          title: "¡Cuenta creada!",
          description: "Ya puedes comenzar a practicar",
        });
        navigate("/scenarios");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        variant: "destructive",
        title: "Error",
        description: message.includes("already")
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
            {!isLogin && (
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-14 bg-card border-2 border-border rounded-2xl px-4 text-foreground placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
            )}

            <div className="relative">
              <Input
                type="email"
                placeholder="Email"
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
