import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BreakdownData } from '@/hooks/useAnalytics';

const COMPETENCY_LABELS: Record<string, string> = {
  apertura: 'Apertura',
  escuchaActiva: 'Escucha Activa',
  manejoObjeciones: 'Manejo Obj.',
  propuestaValor: 'Prop. Valor',
  cierre: 'Cierre',
};

interface CompetencyBarChartProps {
  breakdown: BreakdownData | null;
  maxValue?: number;
}

export function CompetencyBarChart({ breakdown, maxValue = 20 }: CompetencyBarChartProps) {
  if (!breakdown) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos de competencias
      </div>
    );
  }

  const keys = ['apertura', 'escuchaActiva', 'manejoObjeciones', 'propuestaValor', 'cierre'] as const;

  const data = keys.map(key => ({
    name: COMPETENCY_LABELS[key],
    value: breakdown[key] ?? 0,
    fill: (breakdown[key] ?? 0) >= maxValue * 0.7
      ? 'hsl(var(--primary))'
      : (breakdown[key] ?? 0) >= maxValue * 0.5
        ? 'hsl(var(--warning, 45 93% 47%))'
        : 'hsl(var(--destructive))',
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
        />
        <YAxis
          domain={[0, maxValue]}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--popover-foreground))',
          }}
          formatter={(value: number) => [`${value}/${maxValue}`, 'Puntaje']}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
