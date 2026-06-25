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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { useSedes } from "@/hooks/useSedes";
import type { Coach } from "@/hooks/useCoaches";

interface EditCoachModalProps {
  coach: Coach | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditCoachModal({ coach, open, onOpenChange, onSuccess }: EditCoachModalProps) {
  const { toast } = useToast();
  const { sedes, isLoading: sedesLoading } = useSedes();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coach && open) {
      setFirstName(coach.firstName || "");
      setLastName(coach.lastName || "");
      setEmail(coach.email || "");
      setSedeId(coach.sede?.id || "");
    }
  }, [coach, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    setSaving(true);
    try {
      // coachId: null es obligatorio cuando cambia la sede (el backend lo exige)
      // y es correcto para un coach, que no tiene coach propio.
      await api.patch(`/api/admin/users/${coach.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        sedeId,
        coachId: null,
      });
      toast({
        title: "Coach actualizado",
        description: `Se guardaron los cambios de ${firstName.trim() || email.trim()}.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar el coach.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!coach) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar coach</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="coachFirstName">Nombre</Label>
              <Input
                id="coachFirstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coachLastName">Apellido</Label>
              <Input
                id="coachLastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coachEmail">Email</Label>
            <Input
              id="coachEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground">
              Cambiar el email cierra las sesiones activas del coach.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Sede</Label>
            <Select value={sedeId} onValueChange={setSedeId} disabled={saving || sedesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={sedesLoading ? "Cargando..." : "Selecciona una sede"} />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Si el coach tiene alumnos asignados, reasignalos antes de cambiarlo de sede.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
