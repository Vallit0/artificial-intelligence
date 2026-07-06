import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSedes, Sede, CreateSedeInput, UpdateSedeInput } from "@/hooks/useSedes";
import { COUNTRIES, DEFAULT_COUNTRY_CODE, countryLabel } from "@/lib/countries";

interface SedeFormState {
  slug: string;
  name: string;
  country: string;
  city: string;
  address: string;
  isActive: boolean;
}

const EMPTY_FORM: SedeFormState = {
  slug: "",
  name: "",
  country: DEFAULT_COUNTRY_CODE,
  city: "",
  address: "",
  isActive: true,
};

const slugify = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export default function SedesPanel() {
  const { sedes, isLoading, error, createSede, updateSede, deleteSede } = useSedes({
    includeInactive: true,
  });
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Sede | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Sede | null>(null);
  const [form, setForm] = useState<SedeFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (sede: Sede) => {
    setForm({
      slug: sede.slug,
      name: sede.name,
      country: sede.country ?? "",
      city: sede.city ?? "",
      address: sede.address ?? "",
      isActive: sede.isActive,
    });
    setFormError(null);
    setEditing(sede);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const slug = form.slug.trim().toLowerCase();
    const name = form.name.trim();

    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) {
      setFormError("Slug inválido: minúsculas, números y guiones, 2-64 chars.");
      return;
    }
    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const patch: UpdateSedeInput = {
          slug,
          name,
          country: form.country.trim() || null,
          city: form.city.trim() || null,
          address: form.address.trim() || null,
          isActive: form.isActive,
        };
        await updateSede(editing.id, patch);
        toast({ title: "Sede actualizada", description: name });
        setEditing(null);
      } else {
        const input: CreateSedeInput = {
          slug,
          name,
          country: form.country.trim() || undefined,
          city: form.city.trim() || undefined,
          address: form.address.trim() || undefined,
        };
        await createSede(input);
        toast({ title: "Sede creada", description: name });
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
      await deleteSede(confirmDelete.id);
      toast({ title: "Sede eliminada", description: confirmDelete.name });
      setConfirmDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast({ title: "No se pudo eliminar", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (sede: Sede) => {
    try {
      await updateSede(sede.id, { isActive: !sede.isActive });
      toast({
        title: !sede.isActive ? "Sede activada" : "Sede desactivada",
        description: sede.name,
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
            <Building2 className="w-5 h-5 text-primary" />
            Sedes
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva sede
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Cada usuario pertenece a una sede. Los coaches sólo ven datos de su sede; sólo el
          admin global atraviesa sedes.
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
        ) : sedes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no hay sedes registradas. Crea la primera con "Nueva sede".
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Slug</TableHead>
                  <TableHead className="hidden md:table-cell">País / Ciudad</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="w-[140px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sedes.map((sede) => (
                  <TableRow key={sede.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sede.name}</span>
                        {!sede.isActive && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground sm:hidden font-mono">
                        {sede.slug}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">
                      {sede.slug}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {[countryLabel(sede.country), sede.city].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={sede.isActive}
                        onCheckedChange={() => toggleActive(sede)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(sede)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(sede)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sede" : "Nueva sede"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="sede-name">Nombre *</Label>
              <Input
                id="sede-name"
                value={form.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name: value,
                    slug: editing ? prev.slug : slugify(value),
                  }));
                }}
                placeholder="Guatemala"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sede-slug">Slug *</Label>
              <Input
                id="sede-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
                }
                placeholder="guatemala"
                maxLength={64}
                className="font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador estable para código y URLs. Minúsculas, números y guiones.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sede-country">País</Label>
                <Select
                  value={form.country || DEFAULT_COUNTRY_CODE}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, country: value }))}
                >
                  <SelectTrigger id="sede-country">
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
                <Label htmlFor="sede-city">Ciudad</Label>
                <Input
                  id="sede-city"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Ciudad de Guatemala"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sede-address">Dirección</Label>
              <Input
                id="sede-address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Av. Reforma 9-55, Zona 10"
                maxLength={255}
              />
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Sede activa</p>
                  <p className="text-[11px] text-muted-foreground">
                    Las sedes inactivas no aparecen en signup ni para asignar usuarios nuevos.
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
                  "Crear sede"
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
            <AlertDialogTitle>¿Eliminar sede "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              No se puede eliminar una sede con usuarios asignados. Si la sede ya no se usa
              pero tiene usuarios, mejor desactivala con el toggle.
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
