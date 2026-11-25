import { CheckCircle2, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDuration, type TimeByMode } from "@/lib/time-by-mode";

// ============================================
// "¿Qué tiempo cuenta para habilitar mi examen?"
// ============================================
//
// El alumno practica en varios escenarios (Cliente, Prospección, Objeciones,
// Asesor, Coach) pero para habilitar cada examen SÓLO cuentan algunos. Sin este
// desglose, alguien que practicó una hora con el Coach ve "te faltan 30m" y no
// entiende por qué su tiempo no se movió.
//
// Los modos que suman acá son exactamente los del gate del backend
// (server/src/services/sessions.service.ts → PROSPECCION_PRACTICE_MODES /
// OBJECIONES_PRACTICE_MODES). Si cambian allá, cambiarlos acá.

interface SourceRow {
  label: string;
  seconds: number;
  counts: boolean;
  note?: string;
}

interface LevelSources {
  title: string;
  rows: SourceRow[];
}

function buildLevels(data: TimeByMode): LevelSources[] {
  return [
    {
      title: "Examen de Prospección (Nivel 1)",
      rows: [
        {
          label: "Role-Play Cliente — Prospección",
          seconds: data.prospeccionSeconds,
          counts: true,
        },
        {
          label: "Role-Play Cliente — otros escenarios",
          seconds: data.clienteOtrosSeconds,
          counts: true,
        },
        { label: "Role-Play Objeciones", seconds: data.roleplayObjecionesSeconds, counts: false },
        { label: "Role-Play Asesor", seconds: data.roleplayAsesorSeconds, counts: false },
        { label: "Coach", seconds: data.coachSeconds, counts: false },
        {
          label: "Intentos de examen",
          seconds: data.examenProspeccionSeconds + data.examenObjecionesSeconds,
          counts: false,
          note: "rendir el examen no cuenta como práctica",
        },
      ],
    },
    {
      title: "Examen de Manejo de Objeciones (Nivel 2)",
      rows: [
        { label: "Role-Play Objeciones", seconds: data.roleplayObjecionesSeconds, counts: true },
        {
          label: "Role-Play Cliente (incl. Prospección)",
          seconds: data.roleplayClienteSeconds,
          counts: false,
        },
        { label: "Role-Play Asesor", seconds: data.roleplayAsesorSeconds, counts: false },
        { label: "Coach", seconds: data.coachSeconds, counts: false },
        {
          label: "Intentos de examen",
          seconds: data.examenProspeccionSeconds + data.examenObjecionesSeconds,
          counts: false,
          note: "rendir el examen no cuenta como práctica",
        },
      ],
    },
  ];
}

const Row = ({ label, seconds, counts, note }: SourceRow) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <div className="flex min-w-0 items-start gap-2">
      {counts ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0">
        <p className={`text-sm ${counts ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {note && <p className="text-xs text-muted-foreground/70">{note}</p>}
      </div>
    </div>
    <span
      className={`shrink-0 text-sm tabular-nums ${
        counts ? "font-semibold text-primary" : "text-muted-foreground/60 line-through"
      }`}
    >
      {formatDuration(seconds)}
    </span>
  </div>
);

interface ExamTimeSourcesDialogProps {
  data: TimeByMode;
}

export default function ExamTimeSourcesDialog({ data }: ExamTimeSourcesDialogProps) {
  const levels = buildLevels(data);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* `outline` y no `ghost`: el alumno tiene que notar que esto se puede
            abrir — es la respuesta a "¿por qué mi tiempo no baja?". */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Info className="h-3.5 w-3.5" />
          ¿Qué tiempo cuenta para mi examen?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Qué tiempo cuenta para habilitar cada examen?</DialogTitle>
          <DialogDescription>
            Cada examen se habilita con la práctica de su propio nivel. El tiempo de los otros
            escenarios suma a tu tiempo total, pero no acerca este examen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {levels.map((level) => {
            const counted = level.rows
              .filter((r) => r.counts)
              .reduce((acc, r) => acc + r.seconds, 0);
            return (
              <section key={level.title}>
                <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1.5">
                  <h3 className="text-sm font-semibold text-foreground">{level.title}</h3>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                    {formatDuration(counted)}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {level.rows.map((row) => (
                    <Row key={`${level.title}-${row.label}`} {...row} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
