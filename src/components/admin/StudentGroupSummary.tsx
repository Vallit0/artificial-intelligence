import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Download, Layers } from "lucide-react";
import type { Student } from "@/hooks/useStudents";
import { exportStudentSummaryToExcel, type GroupSummaryRow } from "@/lib/export-students";

type GroupBy = "division" | "country" | "sede";

const GROUP_META: Record<GroupBy, { label: string; column: string; empty: string }> = {
  division: { label: "División", column: "División", empty: "Sin división" },
  country: { label: "País", column: "País", empty: "Sin país" },
  sede: { label: "Sede", column: "Sede", empty: "Sin sede" },
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

interface StudentGroupSummaryProps {
  students: Student[];
}

// Resumen de práctica agrupado por división / país / sede. Suma tiempo,
// sesiones y cuenta estudiantes de cada grupo a partir de la lista (ya filtrada
// + acotada al período por el contenedor). Permite exportar el resumen a Excel.
export default function StudentGroupSummary({ students }: StudentGroupSummaryProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("division");

  const rows: GroupSummaryRow[] = useMemo(() => {
    const meta = GROUP_META[groupBy];
    const map = new Map<string, GroupSummaryRow>();
    for (const s of students) {
      const label =
        groupBy === "division"
          ? s.divisionName ?? meta.empty
          : groupBy === "country"
            ? s.country ?? meta.empty
            : s.sedeName ?? meta.empty;
      let row = map.get(label);
      if (!row) {
        row = { group: label, count: 0, sessions: 0, seconds: 0 };
        map.set(label, row);
      }
      row.count += 1;
      row.sessions += s.totalSessions;
      row.seconds += s.totalDuration;
    }
    return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds);
  }, [students, groupBy]);

  const totals = useMemo(
    () => ({
      count: rows.reduce((a, r) => a + r.count, 0),
      sessions: rows.reduce((a, r) => a + r.sessions, 0),
      seconds: rows.reduce((a, r) => a + r.seconds, 0),
    }),
    [rows],
  );

  const meta = GROUP_META[groupBy];

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-5 h-5 text-primary" />
            Resumen de práctica por grupo
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agrupar por:</span>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="division">División</SelectItem>
                <SelectItem value="country">País</SelectItem>
                <SelectItem value="sede">Sede</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportStudentSummaryToExcel(rows, meta.column, groupBy)}
              disabled={rows.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No hay datos para agrupar.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{meta.column}</TableHead>
                  <TableHead className="text-center">Estudiantes</TableHead>
                  <TableHead className="text-center">Sesiones</TableHead>
                  <TableHead className="text-center">Tiempo total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.group}>
                    <TableCell className="font-medium">{r.group}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.sessions}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(r.seconds)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">TOTAL</TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">{totals.count}</TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">{totals.sessions}</TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {formatDuration(totals.seconds)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
