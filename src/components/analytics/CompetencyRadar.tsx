import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { BreakdownData } from '@/hooks/useAnalytics';

const COMPETENCY_LABELS: Record<string, string> = {
  apertura: 'Apertura',
  escuchaActiva: 'Escucha Activa',
  manejoObjeciones: 'Manejo Objeciones',
  propuestaValor: 'Propuesta de Valor',
  cierre: 'Cierre',
};

interface CompetencyRadarProps {
  latest: BreakdownData | null;
  average: BreakdownData | null;
  maxValue?: number;
}

export function CompetencyRadar({ latest, average, maxValue = 20 }: CompetencyRadarProps) {
  if (!latest && !average) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos de competencias disponibles
      </div>
    );
  }

  const keys = ['apertura', 'escuchaActiva', 'manejoObjeciones', 'propuestaValor', 'cierre'] as const;

  const data = keys.map(key => ({
    competency: COMPETENCY_LABELS[key],
    latest: latest?.[key] ?? 0,
    average: average?.[key] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="competency"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, maxValue]}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
        />
        {average && (
          <Radar
            name="Promedio"
            dataKey="average"
            stroke="hsl(var(--muted-foreground))"
            fill="hsl(var(--muted-foreground))"
            fillOpacity={0.15}
            strokeDasharray="4 4"
          />
        )}
        {latest && (
          <Radar
            name="Última sesión"
            dataKey="latest"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--popover-foreground))',
          }}
        />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
