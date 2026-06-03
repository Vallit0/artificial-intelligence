import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ChevronRight,
  GraduationCap,
  Loader2,
  Search,
  UserX,
  Users,
} from "lucide-react";
import { useCoaches, coachDisplayName } from "@/hooks/useCoaches";
import { useStudents, Student } from "@/hooks/useStudents";

interface CoachGroup {
  id: string; // coachId o "__none__"
  name: string;
  sedeName: string | null;
  students: Student[];
}

const NONE_ID = "__none__";

const studentName = (s: Student) =>
  [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "Sin nombre";

interface Props {
  /**
   * Si es admin global se puede listar /api/admin/coaches para mostrar también
   * coaches sin estudiantes asignados. Los coaches sin permiso reciben 403 en
   * ese endpoint, así que en ese caso derivamos los grupos sólo de los estudiantes.
   */
  canListCoaches?: boolean;
}

export default function CoachStudentsPanel({ canListCoaches = false }: Props) {
  const { students, isLoading: studentsLoading, error: studentsError } = useStudents();
  const { coaches, isLoading: coachesLoading } = useCoaches(canListCoaches);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo<CoachGroup[]>(() => {
    const map = new Map<string, CoachGroup>();

    // Sembrar con los coaches conocidos (incluye los que no tienen estudiantes).
    for (const c of coaches) {
      map.set(c.id, {
        id: c.id,
        name: coachDisplayName(c),
        sedeName: c.sede?.name ?? null,
        students: [],
      });
    }

    const noCoach: CoachGroup = { id: NONE_ID, name: "Sin coach asignado", sedeName: null, students: [] };

    for (const s of students) {
      if (!s.coachId) {
        noCoach.students.push(s);
        continue;
      }
      let group = map.get(s.coachId);
      if (!group) {
        group = {
          id: s.coachId,
          name: s.coachName || "Coach",
          sedeName: s.sedeName ?? null,
          students: [],
        };
        map.set(s.coachId, group);
      }
      group.students.push(s);
    }

    const result = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (noCoach.students.length > 0) result.push(noCoach);
    return result;
  }, [students, coaches]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => {
        const coachMatches = g.name.toLowerCase().includes(q);
        if (coachMatches) return g;
        const students = g.students.filter((s) =>
          `${studentName(s)} ${s.email ?? ""}`.toLowerCase().includes(q),
        );
        return students.length ? { ...g, students } : null;
      })
      .filter((g): g is CoachGroup => g !== null);
  }, [groups, query]);

  const isLoading = studentsLoading || (canListCoaches && coachesLoading);
  const totalAssigned = students.filter((s) => s.coachId).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Coaches y sus estudiantes
          </CardTitle>
          <Badge variant="secondary" className="text-[11px]">
            {totalAssigned} de {students.length} asignados
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cada coach con su lista de estudiantes. Hacé clic para desplegar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {studentsError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{studentsError}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por coach, estudiante o email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <UserX className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {groups.length === 0
                ? "No hay coaches ni estudiantes para mostrar."
                : "Nada coincide con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((group) => {
              const isOpen = query.trim() ? true : !!open[group.id];
              const isNone = group.id === NONE_ID;
              return (
                <Collapsible
                  key={group.id}
                  open={isOpen}
                  onOpenChange={(v) => setOpen((prev) => ({ ...prev, [group.id]: v }))}
                  className="border rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isNone
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {isNone ? <UserX className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.name}</p>
                      {group.sedeName && (
                        <p className="text-[11px] text-muted-foreground truncate">{group.sedeName}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Users className="w-3 h-3" />
                      {group.students.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {group.students.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground border-t">
                        Este coach no tiene estudiantes asignados.
                      </p>
                    ) : (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Estudiante</TableHead>
                              <TableHead className="text-center">Sesiones</TableHead>
                              <TableHead className="text-center hidden sm:table-cell">
                                Prom.
                              </TableHead>
                              <TableHead className="text-center">Nota final</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.students.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{studentName(s)}</span>
                                    {s.email && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {s.email}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{s.totalSessions}</TableCell>
                                <TableCell className="text-center hidden sm:table-cell">
                                  {s.averageScore != null ? s.averageScore.toFixed(1) : "—"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {s.finalGrade != null ? (
                                    <Badge variant="secondary">{s.finalGrade}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
