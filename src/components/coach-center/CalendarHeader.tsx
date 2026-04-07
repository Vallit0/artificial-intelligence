import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

const PRIORIDAD_OPTIONS = [
  { value: "todas", label: "Todas", color: "" },
  { value: "alta", label: "Alta", color: "bg-red-500" },
  { value: "media", label: "Media", color: "bg-yellow-400" },
  { value: "baja", label: "Baja", color: "bg-green-500" },
];

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  directors: string[];
  selectedDirector: string;
  onDirectorChange: (d: string) => void;
  selectedPrioridad: string;
  onPrioridadChange: (p: string) => void;
  onAddCita: () => void;
}

export default function CalendarHeader({
  currentDate,
  onDateChange,
  directors,
  selectedDirector,
  onDirectorChange,
  selectedPrioridad,
  onPrioridadChange,
  onAddCita,
}: CalendarHeaderProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const monthYear = format(weekStart, "MMMM yyyy", { locale: es });

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Row 1: Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="w-4 h-4 mr-2" />
                <span className="capitalize">{monthYear}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(d) => d && onDateChange(d)}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button size="sm" onClick={onAddCita}>
          + Nueva Cita
        </Button>
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedDirector} onValueChange={onDirectorChange}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue placeholder="Todos los directores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los directores</SelectItem>
            {directors.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {PRIORIDAD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPrioridadChange(opt.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                selectedPrioridad === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {opt.color && (
                <span className={cn("inline-block w-2 h-2 rounded-full mr-1", opt.color)} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
