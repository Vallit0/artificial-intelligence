import { Building2, Clock, TrendingUp, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreLineChart } from "@/components/analytics/ScoreLineChart";
import type { AdminUsageData } from "@/hooks/useAdminUsage";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

interface SummaryCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

const SummaryCard = ({ icon, value, label }: SummaryCardProps) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

interface UsageAnalyticsProps {
  data: AdminUsageData;
}

export function UsageAnalytics({ data }: UsageAnalyticsProps) {
  const { totals, bySede, activityTrend } = data;

  return (
    <div className="space-y-6">
      {/* Resumen global */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Clock className="h-6 w-6" />}
          value={formatDuration(totals.totalTimeSeconds)}
          label="Tiempo total de práctica"
        />
        <SummaryCard
          icon={<TrendingUp className="h-6 w-6" />}
          value={totals.totalSessions.toLocaleString()}
          label="Sesiones totales"
        />
        <SummaryCard
          icon={<Users className="h-6 w-6" />}
          value={`${totals.activeStudents} / ${totals.totalStudents}`}
          label="Estudiantes activos / total"
        />
      </div>

      {/* Uso por sede */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Uso por sede
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bySede.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No hay sedes con actividad registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-center">Tiempo total</TableHead>
                  <TableHead className="text-center">Sesiones</TableHead>
                  <TableHead className="text-center">Estudiantes activos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySede.map((sede) => (
                  <TableRow key={sede.sedeId}>
                    <TableCell className="font-medium text-foreground">
                      {sede.sedeName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatDuration(sede.totalTimeSeconds)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{sede.totalSessions}</TableCell>
                    <TableCell className="text-center">
                      {sede.activeStudents} / {sede.totalStudents}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tendencia de actividad (uso, no calificaciones) */}
      {activityTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendencia de uso (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreLineChart
              data={activityTrend.map((d) => ({
                date: d.date,
                score: d.count,
                scenarioName: `${d.count} sesiones`,
                breakdown: null,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
