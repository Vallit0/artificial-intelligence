import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { StudentStat } from '@/hooks/useAdminAnalytics';

interface GroupComparisonChartProps {
  students: StudentStat[];
}

export function GroupComparisonChart({ students }: GroupComparisonChartProps) {
  if (students.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos de estudiantes
      </div>
    );
  }

  // Top 20 students by score
  const data = students.slice(0, 20).map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    fullName: s.name,
    score: s.avgScore,
    sessions: s.totalSessions,
  }));

  const getBarColor = (score: number) => {
    if (score >= 80) return 'hsl(var(--primary))';
    if (score >= 60) return 'hsl(142 76% 36%)';
    if (score >= 50) return 'hsl(45 93% 47%)';
    return 'hsl(var(--destructive))';
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--popover-foreground))',
          }}
          formatter={(value: number, _name: string, props: any) => [
            `${value} pts (${props.payload.sessions} sesiones)`,
            'Promedio',
          ]}
          labelFormatter={(_: string, payload: any[]) => payload?.[0]?.payload?.fullName || ''}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
