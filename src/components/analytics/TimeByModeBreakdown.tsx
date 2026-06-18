import { Swords, ShieldQuestion, UserCheck, Sparkles, GraduationCap, HelpCircle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, type TimeByMode } from "@/lib/time-by-mode";

// Render del desglose de tiempo por modo a partir de un TimeByMode (mismo shape
// en backend y frontend). Role-Play Cliente se muestra destacado por ser la
// métrica de la "primera parte" (Nivel 1), con Prospección como sub-fila.

interface RowProps {
  icon: React.ReactNode;
  label: string;
  seconds: number;
  total: number;
  highlight?: boolean;
  sub?: boolean;
  muted?: boolean;
}

const Row = ({ icon, label, seconds, total, highlight, sub, muted }: RowProps) => {
  const pct = total > 0 ? Math.round((seconds / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-3 ${sub ? "pl-7" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              highlight ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {label}
          </span>
          <span className={`shrink-0 text-sm tabular-nums ${highlight ? "font-bold text-primary" : "text-muted-foreground"}`}>
            {formatDuration(seconds)}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${highlight ? "bg-primary" : "bg-muted-foreground/40"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface TimeByModeBreakdownProps {
  data: TimeByMode;
  title?: string;
}

export function TimeByModeBreakdown({ data, title = "Tiempo de práctica por modo" }: TimeByModeBreakdownProps) {
  const total = data.totalSeconds;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Aún no hay tiempo de práctica registrado.</p>
        ) : (
          <>
            {/* Familia Role-Play Cliente (Nivel 1) con Prospección como sub-modo */}
            <Row
              icon={<Swords className="h-4 w-4" />}
              label="Role-Play Cliente (Nivel 1)"
              seconds={data.roleplayClienteSeconds}
              total={total}
              highlight
            />
            <Row
              icon={<MapPin className="h-4 w-4" />}
              label="Prospección"
              seconds={data.prospeccionSeconds}
              total={total}
              sub
            />
            <Row
              icon={<Swords className="h-4 w-4" />}
              label="Cliente (otros escenarios)"
              seconds={data.clienteOtrosSeconds}
              total={total}
              sub
            />

            {/* Otros modos */}
            <Row
              icon={<ShieldQuestion className="h-4 w-4" />}
              label="Role-Play Objeciones"
              seconds={data.roleplayObjecionesSeconds}
              total={total}
            />
            <Row
              icon={<UserCheck className="h-4 w-4" />}
              label="Role-Play Asesor"
              seconds={data.roleplayAsesorSeconds}
              total={total}
            />
            <Row
              icon={<Sparkles className="h-4 w-4" />}
              label="Coach"
              seconds={data.coachSeconds}
              total={total}
            />

            {/* Exámenes finales (no son práctica, se listan aparte) */}
            <Row
              icon={<GraduationCap className="h-4 w-4" />}
              label="Examen Prospección"
              seconds={data.examenProspeccionSeconds}
              total={total}
            />
            <Row
              icon={<GraduationCap className="h-4 w-4" />}
              label="Examen Objeciones"
              seconds={data.examenObjecionesSeconds}
              total={total}
            />

            {data.sinClasificarSeconds > 0 && (
              <Row
                icon={<HelpCircle className="h-4 w-4" />}
                label="Sin clasificar (sesiones previas)"
                seconds={data.sinClasificarSeconds}
                total={total}
                muted
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
