import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Boxes, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDivisions, Division, CreateDivisionInput, UpdateDivisionInput } from "@/hooks/useDivisions";
import { useSedes } from "@/hooks/useSedes";
import { useCoaches, coachDisplayName } from "@/hooks/useCoaches";

// Valor centinela para "sin coach" en el Select (Radix no permite value="").
const NO_COACH = "__none__";

interface DivisionFormState {
  sedeId: string;
  name: string;
  coachId: string; // NO_COACH cuando no hay coach
  isActive: boolean;
}

const EMPTY_FORM: DivisionFormState = {
  sedeId: "",
  name: "",
  coachId: NO_COACH,
  isActive: true,
};

export default function DivisionsPanel() {
  const { divisions, isLoading, error, createDivision, updateDivision, deleteDivision } =
    useDivisions({ includeInactive: true });
  const { sedes } = useSedes({ includeInactive: false });
  const { coaches } = useCoaches();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Division | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Division | null>(null);
  const [form, setForm] = useState<DivisionFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeSedes = useMemo(() => sedes.filter((s) => s.isActive), [sedes]);

  // Coaches disponibles para asignar a la división = coaches de la sede elegida.
  const coachesForSede = useMemo(
    () => coaches.filter((c) => c.sede?.id === form.sedeId),
    [coaches, form.sedeId],
  );

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sedeId: activeSedes[0]?.id ?? "" });
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (division: Division) => {
    setForm({
      sedeId: division.sede?.id ?? "",
      name: division.name,
      coachId: division.coach?.id ?? NO_COACH,
      isActive: division.isActive,
    });
    setFormError(null);
    setEditing(division);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    if (!form.sedeId) {
      setFormError("Debés elegir una sede.");
      return;
    }
    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    const coachId = form.coachId === NO_COACH ? null : form.coachId;

    setSubmitting(true);
    try {
      if (editing) {
        const patch: UpdateDivisionInput = { name, coachId, isActive: form.isActive };
        await updateDivision(editing.id, patch);
        toast({ title: "División actualizada", description: name });
        setEditing(null);
      } else {
        const input: CreateDivisionInput = { sedeId: form.sedeId, name, coachId };
        await createDivision(input);
        toast({ title: "División creada", description: name });
        setCreateOpen(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSubmitting(true);
    try {
      await deleteDivision(confirmDelete.id);
      toast({ title: "División eliminada", description: confirmDelete.name });
      setConfirmDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast({ title: "No se pudo eliminar", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (division: Division) => {
    try {
      await updateDivision(division.id, { isActive: !division.isActive });
      toast({
        title: !division.isActive ? "División activada" : "División desactivada",
        description: division.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            Divisiones
          </CardTitle>
          <Button size="sm" onClick={openCreate} disabled={activeSedes.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva división
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Cada sede tiene varias divisiones y cada división tiene un coach a cargo. Los estudiantes
          se asignan a una división y heredan su coach.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : divisions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no hay divisiones. Crea la primera con "Nueva división".
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Sede</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Estudiantes</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="w-[140px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((division) => (
                  <TableRow key={division.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{division.name}</span>
                        {!division.isActive && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground sm:hidden">
                        {division.sede?.name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {division.sede ? (
                        <Badge variant="outline" className="font-normal">
                          {division.sede.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {division.coach ? (
                        division.coach.name
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin coach</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell text-sm text-muted-foreground">
                      {division.learnerCount}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={division.isActive}
                        onCheckedChange={() => toggleActive(division)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(division)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(division)}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog
        open={createOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar división" : "Nueva división"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="division-sede">Sede *</Label>
              <Select
                value={form.sedeId}
                onValueChange={(v) =>
                  // Cambiar de sede invalida el coach elegido (debe ser de la sede).
                  setForm((prev) => ({ ...prev, sedeId: v, coachId: NO_COACH }))
                }
                disabled={!!editing}
              >
                <SelectTrigger id="division-sede">
                  <SelectValue placeholder="Seleccionar sede" />
                </SelectTrigger>
                <SelectContent>
                  {activeSedes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && (
                <p className="text-[11px] text-muted-foreground">
                  La sede de una división no se puede cambiar.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="division-name">Nombre *</Label>
              <Input
                id="division-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ventas Norte"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="division-coach">Coach a cargo</Label>
              <Select
                value={form.coachId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, coachId: v }))}
              >
                <SelectTrigger id="division-coach">
                  <SelectValue placeholder="Sin coach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COACH}>Sin coach</SelectItem>
                  {coachesForSede.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {coachDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.sedeId && coachesForSede.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No hay coaches en esta sede. Creá uno desde la pantalla de Coaches.
                </p>
              )}
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">División activa</p>
                  <p className="text-[11px] text-muted-foreground">
                    Las divisiones inactivas no aparecen en el signup ni para asignar estudiantes.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, isActive: v }))}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditing(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : editing ? (
                  "Guardar cambios"
                ) : (
                  "Crear división"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar división "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              No se puede eliminar una división con estudiantes asignados. Si ya no se usa pero
              tiene estudiantes, mejor desactivala con el toggle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
