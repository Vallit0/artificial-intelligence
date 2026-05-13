import { useMemo, useState } from "react";
import { useLtiCourseSyncs, LtiCourseSync } from "@/hooks/useLtiCourseSyncs";
import { useLtiPlatforms } from "@/hooks/useLtiPlatforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Edit, Loader2, Plus, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
  platformId: "",
  contextId: "",
  contextTitle: "",
  membershipsUrl: "",
  lineitemUrl: "",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString();
}

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">Pendiente</Badge>;
  if (status === "ok") return <Badge variant="default">OK</Badge>;
  if (status === "partial") return <Badge variant="outline">Parcial</Badge>;
  return <Badge variant="destructive">Error</Badge>;
}

export default function LtiCourseSyncPanel() {
  const { courses, isLoading, createCourse, updateCourse, deleteCourse, syncCourse, syncAll } =
    useLtiCourseSyncs();
  const { platforms } = useLtiPlatforms();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const platformsById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    platforms.forEach((p) => m.set(p.id, { name: p.name }));
    return m;
  }, [platforms]);

  const handleSubmit = async () => {
    if (!form.platformId || !form.contextId || !form.membershipsUrl) {
      toast({
        title: "Error",
        description: "Plataforma, Context ID y Memberships URL son requeridos.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    let ok = false;
    if (editingId) {
      ok = await updateCourse(editingId, {
        contextTitle: form.contextTitle || null,
        membershipsUrl: form.membershipsUrl,
        lineitemUrl: form.lineitemUrl || null,
      });
    } else {
      ok = await createCourse({
        platformId: form.platformId,
        contextId: form.contextId,
        contextTitle: form.contextTitle || undefined,
        membershipsUrl: form.membershipsUrl,
        lineitemUrl: form.lineitemUrl || undefined,
      });
    }
    setSaving(false);
    if (ok) {
      toast({ title: editingId ? "Actualizado" : "Creado", description: "Curso guardado." });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } else {
      toast({ title: "Error", description: "No se pudo guardar el curso.", variant: "destructive" });
    }
  };

  const handleEdit = (c: LtiCourseSync) => {
    setForm({
      platformId: c.platformId,
      contextId: c.contextId,
      contextTitle: c.contextTitle ?? "",
      membershipsUrl: c.membershipsUrl,
      lineitemUrl: c.lineitemUrl ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (c: LtiCourseSync) => {
    const ok = await deleteCourse(c.id);
    if (ok) toast({ title: "Eliminado", description: `Curso "${c.contextTitle ?? c.contextId}" eliminado.` });
  };

  const handleSync = async (c: LtiCourseSync) => {
    setSyncingId(c.id);
    const result = await syncCourse(c.id);
    setSyncingId(null);
    if (result) {
      toast({
        title: "Sync completado",
        description: `${result.matched} match · ${result.created} creados · ${result.pending} pendientes · ${result.skipped} sin email · ${result.errors} errores`,
      });
    } else {
      toast({ title: "Error", description: "No se pudo sincronizar.", variant: "destructive" });
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const result = await syncAll();
    setSyncingAll(false);
    if (result) {
      toast({
        title: "Sync masivo completado",
        description: `${result.coursesSucceeded}/${result.coursesProcessed} cursos OK · ${result.coursesFailed} fallaron`,
      });
    } else {
      toast({ title: "Error", description: "No se pudo sincronizar.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Cursos LTI (Sync NRPS)
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={syncingAll || courses.length === 0}>
            {syncingAll ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
            Sync todos
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Curso
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {courses.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay cursos registrados. Los cursos se autoregistran cuando alguien hace un launch desde Moodle, o podés
            agregarlos manualmente.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Último sync</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.contextTitle ?? "(sin título)"}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate max-w-72">{c.contextId}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.platform?.name ?? platformsById.get(c.platformId)?.name ?? c.platformId}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{formatDate(c.lastSyncedAt)}</div>
                    {c.lastSyncError && (
                      <div className="text-xs text-destructive truncate max-w-48" title={c.lastSyncError}>
                        {c.lastSyncError}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center space-y-1">
                    {statusBadge(c.lastSyncStatus)}
                    {!c.isActive && (
                      <div>
                        <Badge variant="secondary">Pausado</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSync(c)}
                        disabled={syncingId === c.id || !c.isActive}
                        title="Sync ahora"
                      >
                        {syncingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showForm && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId ? "Editar" : "Nuevo"} Curso</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plataforma *</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: e.target.value })}
                  disabled={!!editingId}
                >
                  <option value="">Seleccionar...</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Context ID (Moodle) *</label>
                <Input
                  value={form.contextId}
                  onChange={(e) => setForm({ ...form, contextId: e.target.value })}
                  placeholder="42"
                  disabled={!!editingId}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Título del curso</label>
                <Input
                  value={form.contextTitle}
                  onChange={(e) => setForm({ ...form, contextTitle: e.target.value })}
                  placeholder="Ventas Avanzadas 2026"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Memberships URL (NRPS) *</label>
                <Input
                  value={form.membershipsUrl}
                  onChange={(e) => setForm({ ...form, membershipsUrl: e.target.value })}
                  placeholder="https://moodle.example.com/mod/lti/services.php/CourseSection/42/bindings/4/memberships"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Lineitem URL (AGS, opcional)</label>
                <Input
                  value={form.lineitemUrl}
                  onChange={(e) => setForm({ ...form, lineitemUrl: e.target.value })}
                  placeholder="https://moodle.example.com/mod/lti/services.php/2/lineitems/9/lineitem"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
