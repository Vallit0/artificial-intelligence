import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Cita } from "@/hooks/useCitas";
import CitaCard from "./CitaCard";

const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const HOUR_HEIGHT = 64; // px

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

interface WeeklyCalendarProps {
  currentDate: Date;
  citas: Cita[];
  isAdmin: boolean;
  onEditCita: (cita: Cita) => void;
  onDeleteCita: (id: string) => void;
}

export default function WeeklyCalendar({
  currentDate,
  citas,
  isAdmin,
  onEditCita,
  onDeleteCita,
}: WeeklyCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group citas by day+hour
  function getCitasForDayHour(day: Date, hour: string): Cita[] {
    return citas.filter((c) => {
      const citaDate = new Date(c.fecha);
      return isSameDay(citaDate, day) && c.horaInicio === hour;
    });
  }

  function getCitaCountForDay(day: Date): number {
    return citas.filter((c) => isSameDay(new Date(c.fecha), day)).length;
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
        <div className="border-r bg-muted/30" />
        {days.map((day, i) => {
          const today = isToday(day);
          const count = getCitaCountForDay(day);
          return (
            <div
              key={i}
              className={cn(
                "text-center py-2 border-r last:border-r-0",
                today ? "bg-blue-50 dark:bg-blue-950/30" : "bg-muted/30"
              )}
            >
              <p className={cn(
                "text-xs font-medium",
                today ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
              )}>
                {DAY_NAMES[i]}
              </p>
              <p className={cn(
                "text-lg font-bold",
                today ? "text-blue-600 dark:text-blue-400" : "text-foreground"
              )}>
                {format(day, "d")}
              </p>
              {count > 0 && (
                <span className={cn(
                  "inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                  today
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count} cita{count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto max-h-[calc(64px*10+2px)]">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            {/* Hour label */}
            <div
              className="border-r border-b flex items-start justify-center pt-1 bg-muted/20"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="text-xs text-muted-foreground font-medium">{hour}</span>
            </div>

            {/* Day cells */}
            {days.map((day, di) => {
              const today = isToday(day);
              const dayCitas = getCitasForDayHour(day, hour);

              return (
                <div
                  key={`${hour}-${di}`}
                  className={cn(
                    "border-r border-b last:border-r-0 relative",
                    today && "bg-blue-50/50 dark:bg-blue-950/10"
                  )}
                  style={{ height: HOUR_HEIGHT }}
                >
                  {dayCitas.map((cita) => (
                    <CitaCard
                      key={cita.id}
                      cita={cita}
                      onClick={() => onEditCita(cita)}
                      onDelete={isAdmin ? () => onDeleteCita(cita.id) : undefined}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
