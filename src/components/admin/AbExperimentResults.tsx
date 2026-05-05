import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, BarChart3, FlaskConical, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CompetencyRadar } from '@/components/analytics/CompetencyRadar';
import type { ExperimentResults, VariantResult } from '@/hooks/useAbExperiments';

interface AbExperimentResultsProps {
  results: ExperimentResults;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(221 83% 53%)',
  'hsl(142 76% 36%)',
  'hsl(45 93% 47%)',
  'hsl(0 84% 60%)',
];

export function AbExperimentResults({ results }: AbExperimentResultsProps) {
  const { experiment, results: variantResults } = results;
  const totalSessions = variantResults.reduce((sum, v) => sum + v.sessionCount, 0);
  const hasSmallSample = variantResults.some(v => v.sessionCount < 30);

  // Chart data for score comparison
  const scoreData = variantResults.map(v => ({
    name: v.variantName,
    'Puntaje Promedio': v.avgScore ?? 0,
    'Tasa de Aprobación': v.passRate,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Resultados: {experiment.name}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant={experiment.status === 'active' ? 'default' : 'outline'}>
              {experiment.status === 'active' ? 'Activo' : experiment.status === 'completed' ? 'Completado' : 'Borrador'}
            </Badge>
            <span>Agente: <code className="bg-muted px-1 rounded">{experiment.agentSecretName}</code></span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {totalSessions} sesiones totales
            </span>
          </div>
        </CardHeader>
      </Card>

      {hasSmallSample && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Algunas variantes tienen menos de 30 sesiones. Los resultados pueden no ser estadísticamente significativos.
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativa por Variante</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-center">Asignados</TableHead>
                <TableHead className="text-center">Sesiones</TableHead>
                <TableHead className="text-center">Puntaje Prom.</TableHead>
                <TableHead className="text-center">Aprobación</TableHead>
                <TableHead className="text-center">Duración Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variantResults.map((v, i) => (
                <TableRow key={v.variantId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      {v.variantName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{v.assignmentCount}</TableCell>
                  <TableCell className="text-center">{v.sessionCount}</TableCell>
                  <TableCell className="text-center">
                    {v.avgScore !== null ? (
                      <span className={v.avgScore >= 75 ? 'text-green-600' : 'text-red-600'}>
                        {v.avgScore}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={v.passRate >= 50 ? 'text-green-600' : 'text-red-600'}>
                      {v.passRate}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {v.avgDuration ? `${Math.floor(v.avgDuration / 60)}m ${v.avgDuration % 60}s` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Score Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4" />
            Comparación de Puntajes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend />
              <Bar dataKey="Puntaje Promedio" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tasa de Aprobación" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Radar Comparison (if breakdown data exists) */}
      {variantResults.some(v => v.breakdownAvg.apertura !== null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competencias por Variante</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparación de competencias promedio entre variantes
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variantResults.map((v, i) => (
                <div key={v.variantId}>
                  <p className="text-sm font-medium text-center mb-2 flex items-center justify-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {v.variantName}
                  </p>
                  <CompetencyRadar
                    latest={{
                      apertura: v.breakdownAvg.apertura,
                      escuchaActiva: v.breakdownAvg.escuchaActiva,
                      manejoObjeciones: v.breakdownAvg.manejoObjeciones,
                      propuestaValor: v.breakdownAvg.propuestaValor,
                      cierre: v.breakdownAvg.cierre,
                    }}
                    average={null}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
