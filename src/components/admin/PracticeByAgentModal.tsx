import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Users, Play, Clock } from "lucide-react";
import { formatDuration } from "@/lib/time-by-mode";
import type { ModeStat, TimeByModeSummary } from "@/hooks/useTimeByMode";

export type BreakdownMetric = "students" | "sessions" | "time";

interface PracticeByAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ModeStat[];
  summary: TimeByModeSummary;
  metric: BreakdownMetric;
  isLoading?: boolean;
}

const METRIC_LABEL: Record<BreakdownMetric, string> = {
  students: "Estudiantes",
  sessions: "Sesiones",
  time: "Tiempo",
};

// Valor de orden según la métrica activa.
const metricValue = (m: ModeStat, metric: BreakdownMetric): number =>
  metric === "students" ? m.students : metric === "sessions" ? m.sessions : m.seconds;

export default function PracticeByAgentModal({
  open,
  onOpenChange,
  data,
  summary,
  metric,
  isLoading,
}: PracticeByAgentModalProps) {
  // Filas ordenadas desc por la métrica de la tarjeta clickeada.
  const rows = useMemo(
    () => [...data].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [data, metric],
  );

  const isEmpty = !isLoading && (rows.length === 0 || summary.sessions === 0);

  // Clase para resaltar la columna correspondiente a la métrica activa.
  const hl = (col: BreakdownMetric) =>
    col === metric ? "font-bold text-primary" : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{METRIC_LABEL[metric]} por tipo de llamada (agente)</DialogTitle>
          <DialogDescription>
            Desglose de la práctica por cada tipo de llamada. La columna{" "}
            <span className="font-medium text-foreground">{METRIC_LABEL[metric]}</span> está resaltada.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isEmpty ? (
          <p className="py-10 text-center text-muted-foreground">
            Aún no hay práctica registrada para este período.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de llamada</TableHead>
                  <TableHead className={`text-center ${hl("students")}`}>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Estudiantes
                    </span>
                  </TableHead>
                  <TableHead className={`text-center ${hl("sessions")}`}>
                    <span className="inline-flex items-center gap-1">
                      <Play className="w-3.5 h-3.5" />
                      Sesiones
                    </span>
                  </TableHead>
                  <TableHead className={`text-center ${hl("time")}`}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Tiempo
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className={`text-center tabular-nums ${hl("students")}`}>
                      {m.students}
                    </TableCell>
                    <TableCell className={`text-center tabular-nums ${hl("sessions")}`}>
                      {m.sessions}
                    </TableCell>
                    <TableCell className={`text-center tabular-nums ${hl("time")}`}>
                      {formatDuration(m.seconds)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">TOTAL</TableCell>
                  <TableCell className={`text-center tabular-nums ${hl("students")}`}>
                    {summary.students}
                  </TableCell>
                  <TableCell className={`text-center tabular-nums ${hl("sessions")}`}>
                    {summary.sessions}
                  </TableCell>
                  <TableCell className={`text-center tabular-nums ${hl("time")}`}>
                    {formatDuration(summary.seconds)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
        {!isLoading && !isEmpty && metric === "students" && (
          <p className="text-[11px] text-muted-foreground">
            "Estudiantes" cuenta alumnos distintos que practicaron cada tipo de llamada; un alumno
            que practicó varios tipos cuenta una vez por cada uno, y una sola vez en el TOTAL.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
