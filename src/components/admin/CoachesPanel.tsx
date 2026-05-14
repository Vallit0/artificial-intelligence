import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { AlertCircle, GraduationCap, Loader2, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCoaches, Coach } from "@/hooks/useCoaches";

export default function CoachesPanel() {
  const { coaches, isLoading, error, updatePermissions } = useCoaches();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [sedeFilter, setSedeFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sedeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const c of coaches) {
      if (c.sede) map.set(c.sede.id, { id: c.sede.id, name: c.sede.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [coaches]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coaches.filter((c) => {
      if (sedeFilter !== "all" && c.sede?.id !== sedeFilter) return false;
      if (!q) return true;
      const haystack = `${c.firstName ?? ""} ${c.lastName ?? ""} ${c.email} ${c.sede?.name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [coaches, query, sedeFilter]);

  const togglePermission = async (
    coach: Coach,
    field: "canCreateCoaches" | "canEditPrompts",
    value: boolean,
  ) => {
    setPendingId(coach.id);
    try {
      await updatePermissions(coach.id, { [field]: value });
      toast({
        title: "Permisos actualizados",
        description: `${coach.firstName ?? coach.email}: ${field} ${value ? "activado" : "desactivado"}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Coaches
          </CardTitle>
          <Badge variant="secondary" className="text-[11px]">
            {filtered.length} de {coaches.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Coaches ven sólo los datos de su sede. Los toggles otorgan permisos granulares:
          crear más coaches dentro de su sede y/o editar los prompts de prospección.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o sede..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {sedeOptions.length > 1 && (
            <Select value={sedeFilter} onValueChange={setSedeFilter}>
              <SelectTrigger className="sm:w-64">
                <SelectValue placeholder="Filtrar por sede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {sedeOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <ShieldOff className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {coaches.length === 0
                ? "No hay coaches registrados. Crealos desde 'Estudiantes → Nuevo usuario' eligiendo rol Coach."
                : "No hay coaches que coincidan con el filtro."}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coach</TableHead>
                  <TableHead className="hidden md:table-cell">Sede</TableHead>
                  <TableHead className="text-center">Crear coaches</TableHead>
                  <TableHead className="text-center">Editar prompts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((coach) => {
                  const fullName =
                    [coach.firstName, coach.lastName].filter(Boolean).join(" ") || coach.email;
                  const busy = pendingId === coach.id;
                  return (
                    <TableRow key={coach.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{fullName}</span>
                            {(coach.permissions.canCreateCoaches ||
                              coach.permissions.canEditPrompts) && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{coach.email}</span>
                          {coach.sede && (
                            <span className="text-[10px] text-muted-foreground md:hidden mt-0.5">
                              {coach.sede.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {coach.sede ? (
                          <Badge variant="outline" className="font-normal">
                            {coach.sede.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-2">
                          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={coach.permissions.canCreateCoaches}
                            disabled={busy}
                            onCheckedChange={(v) =>
                              togglePermission(coach, "canCreateCoaches", v)
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={coach.permissions.canEditPrompts}
                          disabled={busy}
                          onCheckedChange={(v) =>
                            togglePermission(coach, "canEditPrompts", v)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">Crear coaches:</strong> el coach puede crear
            otros coaches en su misma sede desde el panel de Estudiantes.
          </p>
          <p>
            <strong className="text-foreground">Editar prompts:</strong> el coach puede modificar
            los prompts de prospección y el primer mensaje (afecta a toda la plataforma, no sólo
            a su sede).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
