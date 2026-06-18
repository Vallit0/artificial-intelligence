import { useMemo } from "react";
import { CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_PERIOD,
  hasPeriod,
  monthToPeriod,
  periodEqualsMonth,
  recentMonths,
  type Period,
} from "@/lib/period";

// Filtro de período controlado: selector de mes + rango de fechas (desde/hasta).
// Ambos escriben el mismo Period; el botón limpia. El componente padre es la
// fuente de verdad y pasa el período a los hooks/export.
interface PeriodFilterProps {
  value: Period;
  onChange: (p: Period) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const months = useMemo(() => recentMonths(12), []);

  const selectValue =
    months.find((m) => periodEqualsMonth(value, m.value))?.value ??
    (hasPeriod(value) ? "custom" : "all");

  const handleMonth = (v: string) => {
    if (v === "all") onChange(EMPTY_PERIOD);
    else if (v !== "custom") onChange(monthToPeriod(v));
  };

  const handleDate = (which: "from" | "to", dateStr: string) => {
    onChange({ ...value, [which]: dateStr || null });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Mes</Label>
        <Select value={selectValue} onValueChange={handleMonth}>
          <SelectTrigger className="h-9 w-44">
            <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el tiempo</SelectItem>
            {selectValue === "custom" && (
              <SelectItem value="custom" disabled>
                Rango personalizado
              </SelectItem>
            )}
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Desde</Label>
        <Input
          type="date"
          className="h-9 w-40"
          value={value.from ?? ""}
          max={value.to ?? undefined}
          onChange={(e) => handleDate("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Hasta</Label>
        <Input
          type="date"
          className="h-9 w-40"
          value={value.to ?? ""}
          min={value.from ?? undefined}
          onChange={(e) => handleDate("to", e.target.value)}
        />
      </div>

      {hasPeriod(value) && (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(EMPTY_PERIOD)}>
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
