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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle, GraduationCap, Shield, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { useSedes } from "@/hooks/useSedes";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type UserRole = "learner" | "coach" | "admin";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string; icon: React.ElementType }> = [
  {
    value: "learner",
    label: "Asesor (learner)",
    description: "Estudiante que practica con los agentes. Es el rol por defecto.",
    icon: User,
  },
  {
    value: "coach",
    label: "Coach",
    description: "Ve sólo datos de su sede. Permisos granulares se asignan después en la tab Coaches.",
    icon: GraduationCap,
  },
  {
    value: "admin",
    label: "Admin global",
    description: "Acceso total, atraviesa todas las sedes. Usar con cuidado.",
    icon: Shield,
  },
];

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
  const { sedes, isLoading: sedesLoading } = useSedes();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("learner");
  const [sedeId, setSedeId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Preseleccioná la primera sede activa cuando carguen — evita que el admin
  // tenga que abrir el dropdown sólo para confirmar la opción única en setups
  // de una sola sede (caso típico hoy: Guatemala).
  useEffect(() => {
    if (!sedeId && sedes.length > 0) {
      const firstActive = sedes.find((s) => s.isActive);
      if (firstActive) setSedeId(firstActive.id);
    }
  }, [sedes, sedeId]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRole("learner");
    setSedeId(sedes.find((s) => s.isActive)?.id ?? "");
    setError(null);
    setSuccess(false);
  };

  const validateForm = (): string | null => {
    if (!email.trim()) return "El email es requerido";
    if (!isValidEmail(email.trim())) return "Formato de email inválido";
    if (!password) return "La contraseña es requerida";
    if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres";
    if (!sedeId) return "Debes seleccionar una sede";
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
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        sedeId,
      });

      setSuccess(true);
      toast({
        title: "Usuario creado",
        description: `${email} (${role}) ha sido creado exitosamente`,
      });

      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onSuccess();
      }, 1000);
    } catch (err) {
      console.error("Error creating user:", err);
      const message = err instanceof Error ? err.message : "Error de conexión.";
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

  const activeSedes = sedes.filter((s) => s.isActive);
  const selectedRole = ROLE_OPTIONS.find((r) => r.value === role);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
                disabled={isSubmitting || success}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                disabled={isSubmitting || success}
                maxLength={50}
              />
            </div>
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
              placeholder="Mínimo 12 caracteres"
              minLength={12}
              required
              disabled={isSubmitting || success}
              maxLength={72}
            />
            <p className="text-xs text-muted-foreground">
              La contraseña debe tener al menos 12 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sede">Sede *</Label>
            <Select
              value={sedeId}
              onValueChange={setSedeId}
              disabled={isSubmitting || success || sedesLoading}
            >
              <SelectTrigger id="sede">
                <SelectValue
                  placeholder={sedesLoading ? "Cargando sedes..." : "Seleccionar sede"}
                />
              </SelectTrigger>
              <SelectContent>
                {activeSedes.length === 0 && !sedesLoading && (
                  <SelectItem value="__none__" disabled>
                    No hay sedes activas — creá una primero
                  </SelectItem>
                )}
                {activeSedes.map((sede) => (
                  <SelectItem key={sede.id} value={sede.id}>
                    {sede.name}
                    {sede.country ? ` · ${sede.country}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              disabled={isSubmitting || success}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedRole && (
              <p className="text-[11px] text-muted-foreground">{selectedRole.description}</p>
            )}
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
