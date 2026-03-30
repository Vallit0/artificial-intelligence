import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  // No token = invalid link
  if (!token) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Enlace Inválido</h1>
            <p className="text-muted-foreground mt-2">
              Enlace inválido o expirado. Solicita uno nuevo.
            </p>
          </div>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Volver a Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  const validatePassword = (): string | null => {
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
    if (password !== confirmPassword) {
      return "Las contraseñas no coinciden";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/reset-password", { token, password });

      setSuccess(true);
      toast({
        title: "¡Contraseña actualizada!",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });

      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (err) {
      console.error("Password update error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error al actualizar contraseña. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">¡Contraseña Actualizada!</h1>
            <p className="text-muted-foreground mt-2">
              Redirigiendo a inicio de sesión...
            </p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Nueva Contraseña</h1>
            <p className="text-muted-foreground mt-2">
              Ingresa tu nueva contraseña
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                minLength={6}
                disabled={loading}
                className="h-14 bg-card border-2 border-border rounded-2xl px-4 pr-12 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
                minLength={6}
                disabled={loading}
                className="h-14 bg-card border-2 border-border rounded-2xl px-4 pr-12 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Mínimo 6 caracteres
            </p>

            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider shadow-[0_4px_0_0_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)] hover:translate-y-[2px] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Contraseña"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
