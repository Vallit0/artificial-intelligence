import { useEffect, useState } from "react";
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
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { Student } from "@/hooks/useStudents";

// Acepta cualquier usuario (estudiante o coach): el endpoint
// /users/:id/password aplica a cualquier rol.
type ResettableUserRef = Pick<Student, "id" | "email" | "first_name" | "last_name">;

interface ResetStudentPasswordModalProps {
  student: ResettableUserRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_LENGTH = 6;

export default function ResetStudentPasswordModal({
  student,
  open,
  onOpenChange,
}: ResetStudentPasswordModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirm(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const validate = (): string | null => {
    if (!password) return "Ingresa una contraseña nueva";
    if (password.length < MIN_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres`;
    }
    if (password !== confirmPassword) {
      return "Las contraseñas no coinciden";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${student.id}/password`, { password });
      setSuccess(true);
      toast({
        title: "Contraseña reseteada",
        description: `Se asignó una nueva contraseña a ${student.email}.`,
      });
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo cambiar la contraseña";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!student) return null;

  const displayName =
    [student.first_name, student.last_name].filter(Boolean).join(" ") || student.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Resetear contraseña
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{student.email}</p>
          </div>

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
                Contraseña actualizada. Recuerda compartirla con el estudiante por un canal seguro.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reset-password">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder={`Mínimo ${MIN_LENGTH} caracteres`}
                disabled={isSubmitting || success}
                minLength={MIN_LENGTH}
                maxLength={72}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="reset-confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Repite la contraseña"
                disabled={isSubmitting || success}
                minLength={MIN_LENGTH}
                maxLength={72}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              El estudiante deberá usar esta contraseña en su próximo inicio de sesión.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || success}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardado
                </>
              ) : (
                "Resetear contraseña"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
