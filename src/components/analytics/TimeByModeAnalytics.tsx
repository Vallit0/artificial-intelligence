import { Clock, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeByModeBreakdown } from "@/components/analytics/TimeByModeBreakdown";
import type { TimeByModeData } from "@/hooks/useTimeByMode";
import { formatDuration } from "@/lib/time-by-mode";

// Desglose de tiempo por modo para admin (todos / por sede) y coach (sus alumnos
// asignados). El backend decide el alcance según el rol del caller. Recibe los
// datos por props para que el contenedor (Admin) pueda compartirlos con el
// export a Excel sin re-fetchear.
interface TimeByModeAnalyticsProps {
  data: TimeByModeData | null;
  isLoading: boolean;
  error: string | null;
}

export function TimeByModeAnalytics({ data, isLoading, error }: TimeByModeAnalyticsProps) {

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No se pudo cargar el desglose de tiempo por modo.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <TimeByModeBreakdown data={data.totals} title="Tiempo total por modo" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Tiempo por alumno
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byStudent.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No hay alumnos con tiempo de práctica registrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead className="text-center">Cliente (Prospección)</TableHead>
                    <TableHead className="text-center">· Prospección</TableHead>
                    <TableHead className="text-center">Objeciones</TableHead>
                    <TableHead className="text-center">Asesor</TableHead>
                    <TableHead className="text-center">Coach</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byStudent.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                      <TableCell className="text-center font-semibold text-primary">
                        {formatDuration(s.roleplayClienteSeconds)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatDuration(s.prospeccionSeconds)}
                      </TableCell>
                      <TableCell className="text-center">{formatDuration(s.roleplayObjecionesSeconds)}</TableCell>
                      <TableCell className="text-center">{formatDuration(s.roleplayAsesorSeconds)}</TableCell>
                      <TableCell className="text-center">{formatDuration(s.coachSeconds)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatDuration(s.totalSeconds)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
