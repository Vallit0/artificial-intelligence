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
import { usePublicDivisions } from "@/hooks/useDivisions";
import { COUNTRIES, DEFAULT_COUNTRY_CODE, countryLabel } from "@/lib/countries";

type UserRole = "learner" | "coach" | "admin";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  // Preselecciona el rol al abrir. Útil para flujos dedicados (p. ej. "Crear
  // coach" desde la pantalla de Coaches).
  defaultRole?: UserRole;
  // Oculta el selector de rol y fija `defaultRole` — el usuario no puede
  // cambiarlo. Va de la mano con `defaultRole`.
  lockRole?: boolean;
  // Texto del título del modal (default "Crear Nuevo Usuario").
  title?: string;
}

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
  defaultRole = "learner",
  lockRole = false,
  title = "Crear Nuevo Usuario",
}: CreateUserModalProps) {
  const { toast } = useToast();
  const { sedes, isLoading: sedesLoading } = useSedes();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [sedeId, setSedeId] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Divisiones activas de la sede elegida (endpoint público, sede-scoped).
  // Cadena País → Sede → División: al cambiar la sede se recargan.
  const { divisions, isLoading: divisionsLoading } = usePublicDivisions(sedeId || null);

  // Sedes activas del país seleccionado. Las sedes legacy sin país se tratan
  // como Guatemala (el país por defecto), para que no desaparezcan del listado.
  const activeSedes = sedes.filter(
    (s) => s.isActive && (s.country ?? DEFAULT_COUNTRY_CODE) === country,
  );

  // Al cambiar de país (o al cargar), si la sede elegida ya no pertenece al
  // país, preseleccioná la primera sede activa de ese país. Evita que el admin
  // tenga que abrir el dropdown en el caso típico de una sola sede por país.
  useEffect(() => {
    if (!activeSedes.some((s) => s.id === sedeId)) {
      setSedeId(activeSedes[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, sedes]);

  // Si la sede cambió y la división elegida ya no pertenece a la nueva lista,
  // la limpiamos para no enviar una división de otra sede.
  useEffect(() => {
    if (divisionId && !divisions.some((d) => d.id === divisionId)) {
      setDivisionId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisions]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRole(defaultRole);
    setCountry(DEFAULT_COUNTRY_CODE);
    setSedeId("");
    setDivisionId("");
    setError(null);
    setSuccess(false);
  };

  const validateForm = (): string | null => {
    if (!email.trim()) return "El email es requerido";
    if (!isValidEmail(email.trim())) return "Formato de email inválido";
    if (!password) return "La contraseña es requerida";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
    if (!sedeId) return "Debes seleccionar una sede";
    // La división es obligatoria para un asesor cuando la sede tiene divisiones.
    // Para un coach es opcional (dirigir una división al crearlo es puntual).
    if (role === "learner" && divisions.length > 0 && !divisionId) {
      return "Debes seleccionar una división";
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
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        sedeId,
        // Sólo se envía si el admin eligió una división. Para learner define
        // su división+coach; para coach lo pone a dirigir esa división.
        ...(divisionId ? { divisionId } : {}),
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

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === role);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
              disabled={isSubmitting || success}
              maxLength={72}
            />
            <p className="text-xs text-muted-foreground">
              La contraseña debe tener al menos 8 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">País *</Label>
            <Select
              value={country}
              onValueChange={setCountry}
              disabled={isSubmitting || success || sedesLoading}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder="Seleccionar país" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    No hay sedes en {countryLabel(country)} — creá una primero
                  </SelectItem>
                )}
                {activeSedes.map((sede) => (
                  <SelectItem key={sede.id} value={sede.id}>
                    {sede.name}
                    {sede.country ? ` · ${countryLabel(sede.country)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sedeId && divisions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="division">
                {role === "coach" ? "División a dirigir" : "División"}
                {role === "learner" ? " *" : ""}
              </Label>
              <Select
                value={divisionId}
                onValueChange={setDivisionId}
                disabled={isSubmitting || success || divisionsLoading}
              >
                <SelectTrigger id="division">
                  <SelectValue
                    placeholder={
                      divisionsLoading
                        ? "Cargando divisiones..."
                        : role === "coach"
                          ? "Sin asignar (opcional)"
                          : "Seleccionar división"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {role === "coach"
                  ? "El coach pasará a dirigir esta división (reemplaza al coach actual)."
                  : "El asesor hereda el coach de la división."}
              </p>
            </div>
          )}

          {!lockRole && (
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
          )}

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
