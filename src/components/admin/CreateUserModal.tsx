import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, CheckCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function CreateUserModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setIsAdmin(false);
    setError(null);
    setSuccess(false);
  };

  const validateForm = (): string | null => {
    if (!email.trim()) {
      return "El email es requerido";
    }
    if (!isValidEmail(email.trim())) {
      return "Formato de email inválido";
    }
    if (!password) {
      return "La contraseña es requerida";
    }
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post("/api/admin/users", {
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        isAdmin,
      });

      setSuccess(true);
      toast({
        title: "Usuario creado",
        description: `${email} ha sido creado exitosamente`,
      });

      // Wait a moment to show success state, then close
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error("Error creating user:", error);
      const message = error instanceof Error ? error.message : "Error de conexión. Verifica tu conexión a internet.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-primary bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                Usuario creado exitosamente
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre Completo</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
              disabled={isSubmitting || success}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="usuario@ejemplo.com"
              required
              disabled={isSubmitting || success}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
              disabled={isSubmitting || success}
              maxLength={72}
            />
            <p className="text-xs text-muted-foreground">
              La contraseña debe tener al menos 6 caracteres
            </p>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Checkbox
              id="isAdmin"
              checked={isAdmin}
              onCheckedChange={(checked) => setIsAdmin(checked === true)}
              disabled={isSubmitting || success}
            />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Label htmlFor="isAdmin" className="text-sm font-medium cursor-pointer">
                Permisos de Administrador
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || success}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Creado
                </>
              ) : (
                "Crear Usuario"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
