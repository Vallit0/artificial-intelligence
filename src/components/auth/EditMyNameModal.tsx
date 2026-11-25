import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2, UserPen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";

interface EditMyNameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_LENGTH = 50;

// Permite a un admin/coach ponerse nombre y apellido. El nombre es lo que el
// agente de ElevenLabs recibe como `advisor_name` (si está vacío, saluda
// "Visitante"), así que es el camino para que el agente llame al admin por
// su nombre durante las prácticas.
export function EditMyNameModal({ open, onOpenChange }: EditMyNameModalProps) {
  const { toast } = useToast();
  const { user, patchUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precarga los valores actuales cada vez que se abre el modal.
  useEffect(() => {
    if (open) {
      setFirstName(user?.firstName ?? "");
      setLastName(user?.lastName ?? "");
      setError(null);
      setSuccess(false);
    }
  }, [open, user?.firstName, user?.lastName]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null);
      setSuccess(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) {
      setError("Ingresa tu nombre");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.patch<{ user: { firstName: string | null; lastName: string | null } }>(
        "/auth/me",
        { firstName: cleanFirst, lastName: cleanLast },
      );
      // Actualiza el usuario en memoria: Practice/Examen leen user.firstName y
      // el hook de ElevenLabs lo envía como advisor_name en la próxima conexión.
      patchUser({
        firstName: data.user.firstName ?? undefined,
        lastName: data.user.lastName ?? undefined,
      });
      setSuccess(true);
      toast({
        title: "Nombre actualizado",
        description: `El agente te llamará "${data.user.firstName}" en tus próximas prácticas.`,
      });
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el nombre";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="w-5 h-5" />
            Editar mi nombre
          </DialogTitle>
          <DialogDescription>
            Este es el nombre con el que el agente de voz te saludará durante las prácticas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-primary bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">Nombre actualizado</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="my-first-name">Nombre</Label>
            <Input
              id="my-first-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError(null);
              }}
              placeholder="Ej. Carlos"
              disabled={isSubmitting || success}
              maxLength={MAX_LENGTH}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="my-last-name">Apellido (opcional)</Label>
            <Input
              id="my-last-name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setError(null);
              }}
              placeholder="Ej. Pérez"
              disabled={isSubmitting || success}
              maxLength={MAX_LENGTH}
            />
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
                  Guardando...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardado
                </>
              ) : (
                "Guardar nombre"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
