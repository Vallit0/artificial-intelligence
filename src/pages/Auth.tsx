import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Phone } from "lucide-react";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";
import AICompanionOrb from "@/components/AICompanionOrb";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        navigate("/practice");
      } else {
        await signUp(email, password, fullName || undefined, phoneNumber || undefined);
        toast({
          title: "¡Cuenta creada!",
          description: "Ya puedes comenzar a practicar",
        });
        navigate("/practice");
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
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsLogin(!isLogin)}
          className="font-bold text-sm text-muted-foreground hover:text-foreground"
        >
          {isLogin ? "Crear cuenta" : "Ya tengo cuenta"}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Orb */}
        <div className="mb-6">
          <AICompanionOrb size="md" listening={false} speaking={false} />
        </div>

        <h1
          className="text-2xl font-extrabold text-foreground text-center mb-1"
          style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
        >
          {isLogin ? "Bienvenido de vuelta" : "Crea tu cuenta"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {isLogin
            ? "Ingresa tus credenciales para continuar"
            : "Empieza a entrenar con Álvaro"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-sm">
          {!isLogin && (
            <>
              <Input
                type="text"
                placeholder="Nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-13 bg-card border border-border rounded-xl px-4 text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors"
              />
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="WhatsApp (ej: 502 1234 5678)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-13 bg-card border border-border rounded-xl pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors"
                />
              </div>
            </>
          )}

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-13 bg-card border border-border rounded-xl px-4 text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors"
          />

          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className="h-13 bg-card border border-border rounded-xl px-4 pr-24 text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  ¿Olvidaste?
                </button>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-13 rounded-xl text-base font-bold tracking-wide transition-all active:scale-[0.98]"
          >
            {loading
              ? "Cargando..."
              : isLogin
              ? "Iniciar Sesión"
              : "Registrarse"}
          </Button>
        </form>

        {/* Terms */}
        <p className="text-center text-xs text-muted-foreground mt-6 max-w-xs">
          Al continuar aceptas nuestros{" "}
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

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      />
    </div>
  );
};

export default Auth;
