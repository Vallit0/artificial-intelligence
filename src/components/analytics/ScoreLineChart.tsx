import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { ScoreHistoryEntry } from '@/hooks/useAnalytics';

interface ScoreLineChartProps {
  data: ScoreHistoryEntry[];
}

export function ScoreLineChart({ data }: ScoreLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay historial de puntajes
      </div>
    );
  }

  const chartData = data.map((entry, i) => ({
    index: i + 1,
    score: entry.score,
    date: new Date(entry.date).toLocaleDateString('es-GT', { month: 'short', day: 'numeric' }),
    scenario: entry.scenarioName,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
          formatter={(value: number) => [`${value} pts`, 'Puntaje']}
          labelFormatter={(label: string) => label}
        />
        <ReferenceLine
          y={50}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 4"
          label={{ value: 'Aprobado', fill: 'hsl(var(--destructive))', fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
