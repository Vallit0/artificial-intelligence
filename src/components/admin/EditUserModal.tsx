import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { Student, UpdateUserPatch } from "@/hooks/useStudents";
import { usePublicSedes } from "@/hooks/useSedes";
import { usePublicDivisions } from "@/hooks/useDivisions";

interface EditUserModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (userId: string, patch: UpdateUserPatch) => Promise<boolean>;
}

const NO_DIVISION = "__none__";
const ALL_ROLES = ["learner", "coach", "instructor", "admin"] as const;
type Role = (typeof ALL_ROLES)[number];

interface EditableUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  sedeId: string | null;
  coachId: string | null;
  divisionId: string | null;
  divisionName: string | null;
  roles: string[];
  examenFinalEnabled: boolean;
  examenObjecionesEnabled: boolean;
  level2Unlocked: boolean;
  courseCompleted: boolean;
  tutorialCompleted: boolean;
  emailVerified: boolean;
}

const FLAGS: { key: keyof EditableUser; label: string }[] = [
  { key: "examenFinalEnabled", label: "Examen Prospección habilitado" },
  { key: "examenObjecionesEnabled", label: "Examen Objeciones habilitado" },
  { key: "level2Unlocked", label: "Objeciones desbloqueado" },
  { key: "courseCompleted", label: "Curso completado" },
  { key: "tutorialCompleted", label: "Tutorial completado" },
  { key: "emailVerified", label: "Email verificado" },
];

export default function EditUserModal({ student, open, onOpenChange, onSubmit }: EditUserModalProps) {
  const { toast } = useToast();
  const { sedes } = usePublicSedes();
  const [original, setOriginal] = useState<EditableUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [divisionId, setDivisionId] = useState<string>(NO_DIVISION);
  const [roles, setRoles] = useState<Role[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const { divisions, isLoading: divisionsLoading } = usePublicDivisions(open ? sedeId : undefined);

  // Cargar el estado editable completo al abrir (incluye roles y flags que el
  // listado de estudiantes no trae).
  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<EditableUser>(`/api/admin/users/${student.id}`);
        if (cancelled) return;
        setOriginal(data);
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setEmail(data.email);
        setPhoneNumber(data.phoneNumber || "");
        setSedeId(data.sedeId || "");
        setDivisionId(data.divisionId || NO_DIVISION);
        setRoles((data.roles as Role[]).filter((r) => ALL_ROLES.includes(r)));
        setFlags({
          examenFinalEnabled: data.examenFinalEnabled,
          examenObjecionesEnabled: data.examenObjecionesEnabled,
          level2Unlocked: data.level2Unlocked,
          courseCompleted: data.courseCompleted,
          tutorialCompleted: data.tutorialCompleted,
          emailVerified: data.emailVerified,
        });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "No se pudo cargar el usuario",
        });
        onOpenChange(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  const sedeChanged = !!original && sedeId !== (original.sedeId || "");

  // Al cambiar de sede, la división previa ya no es válida (es de la sede vieja).
  useEffect(() => {
    if (sedeChanged) setDivisionId(NO_DIVISION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  const toggleRole = (role: Role, checked: boolean) => {
    setRoles((prev) => (checked ? [...new Set([...prev, role])] : prev.filter((r) => r !== role)));
  };

  const emailChanged = !!original && email.trim().toLowerCase() !== original.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !original) return;

    if (roles.length === 0) {
      toast({ variant: "destructive", title: "Falta rol", description: "El usuario debe tener al menos un rol." });
      return;
    }

    const patch: UpdateUserPatch = {};
    if (firstName.trim() !== (original.firstName || "")) patch.firstName = firstName.trim() || null;
    if (lastName.trim() !== (original.lastName || "")) patch.lastName = lastName.trim() || null;
    if (phoneNumber.trim() !== (original.phoneNumber || "")) patch.phoneNumber = phoneNumber.trim() || null;
    if (emailChanged) patch.email = email.trim().toLowerCase();

    const divisionVal = divisionId === NO_DIVISION ? null : divisionId;
    if (sedeChanged) {
      // El backend exige divisionId (puede ser null) cuando cambia la sede.
      patch.sedeId = sedeId;
      patch.divisionId = divisionVal;
    } else if (divisionVal !== (original.divisionId || null)) {
      patch.divisionId = divisionVal;
    }

    const rolesChanged =
      roles.length !== original.roles.length || roles.some((r) => !original.roles.includes(r));
    if (rolesChanged) patch.roles = roles;

    for (const { key } of FLAGS) {
      if (flags[key] !== original[key]) {
        (patch as Record<string, unknown>)[key] = flags[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      toast({ title: "Sin cambios", description: "No hay nada que actualizar." });
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit(student.id, patch);
      if (ok) {
        toast({ title: "Usuario actualizado", description: "Los cambios se guardaron correctamente." });
        onOpenChange(false);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar el usuario",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>

        {loading || !original ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eu-first">Nombre</Label>
                <Input id="eu-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eu-last">Apellido</Label>
                <Input id="eu-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={50} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eu-email">Email</Label>
              <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailChanged && (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Cambiar el email cerrará las sesiones activas del usuario.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="eu-phone">Teléfono</Label>
              <Input id="eu-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sede</Label>
                <Select value={sedeId} onValueChange={setSedeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>División</Label>
                <Select value={divisionId} onValueChange={setDivisionId} disabled={!sedeId || divisionsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={divisionsLoading ? "Cargando..." : "Sin división"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DIVISION}>Sin división</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El coach del estudiante se hereda de la división elegida.
            </p>
            {sedeChanged && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Cambiaste la sede: elegí una división de la sede destino (o "Sin división").
              </p>
            )}

            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={roles.includes(role)}
                      onCheckedChange={(v) => toggleRole(role, !!v)}
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Progreso / flags</Label>
              <div className="space-y-2">
                {FLAGS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Switch
                      checked={!!flags[key]}
                      onCheckedChange={(v) => setFlags((prev) => ({ ...prev, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
