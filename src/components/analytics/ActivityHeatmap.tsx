import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActivityEntry } from '@/hooks/useAnalytics';

interface ActivityHeatmapProps {
  data: ActivityEntry[];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const { grid, maxCount, months } = useMemo(() => {
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Build lookup
    const lookup: Record<string, number> = {};
    let max = 1;
    for (const entry of data) {
      lookup[entry.date] = entry.count;
      if (entry.count > max) max = entry.count;
    }

    // Build grid: 13 weeks x 7 days
    const weeks: Array<Array<{ date: string; count: number; dayOfWeek: number }>> = [];
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    const current = new Date(ninetyDaysAgo);
    // Align to start of week (Sunday)
    current.setDate(current.getDate() - current.getDay());

    let weekIndex = 0;
    while (current <= today || weeks.length < 13) {
      const week: typeof weeks[0] = [];
      for (let day = 0; day < 7; day++) {
        const dateStr = current.toISOString().split('T')[0];
        const month = current.getMonth();
        if (month !== lastMonth && day === 0) {
          monthLabels.push({
            label: current.toLocaleDateString('es-GT', { month: 'short' }),
            weekIndex,
          });
          lastMonth = month;
        }
        week.push({
          date: dateStr,
          count: lookup[dateStr] || 0,
          dayOfWeek: day,
        });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
      weekIndex++;
      if (weeks.length >= 13) break;
    }

    return { grid: weeks, maxCount: max, months: monthLabels };
  }, [data]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const intensity = count / maxCount;
    if (intensity <= 0.25) return 'bg-primary/20';
    if (intensity <= 0.5) return 'bg-primary/40';
    if (intensity <= 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };

  const dayLabels = ['', 'Lun', '', 'Mié', '', 'Vie', ''];

  return (
    <div className="space-y-1">
      {/* Month labels */}
      <div className="flex gap-[3px] ml-8">
        {months.map((m, i) => (
          <div
            key={i}
            className="text-xs text-muted-foreground"
            style={{ position: 'relative', left: `${m.weekIndex * 15}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="text-[10px] text-muted-foreground h-3 flex items-center">
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <Tooltip key={di}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {day.count} {day.count === 1 ? 'sesión' : 'sesiones'} - {day.date}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 ml-8 mt-2">
        <span className="text-xs text-muted-foreground mr-1">Menos</span>
        <div className="w-3 h-3 rounded-sm bg-muted" />
        <div className="w-3 h-3 rounded-sm bg-primary/20" />
        <div className="w-3 h-3 rounded-sm bg-primary/40" />
        <div className="w-3 h-3 rounded-sm bg-primary/60" />
        <div className="w-3 h-3 rounded-sm bg-primary" />
        <span className="text-xs text-muted-foreground ml-1">Más</span>
      </div>
    </div>
  );
}
