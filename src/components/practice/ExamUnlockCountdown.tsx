import { AlertTriangle, CheckCircle2, Timer } from "lucide-react";
import type { PracticeMode } from "@/hooks/usePracticeSessions";
import type { TimeByMode } from "@/lib/time-by-mode";
import { evaluateExamGate } from "@/lib/exam-gate";

// ============================================
// Contador "Tiempo para habilitar examen" (en llamada)
// ============================================
//
// Durante la práctica le muestra al alumno cuánto le falta para que el examen
// DE ESTE NIVEL se habilite solo, descontando en vivo los segundos de la llamada
// en curso. El escenario define a qué examen suma (mismo mapeo que el gate del
// backend en sessions.service.ts):
//
//   cliente / cliente_prospeccion → Examen de Prospección
//   objeciones                    → Examen de Objeciones
//   asesor / coach                → no suman a ninguno
//
// Ojo: el tiempo en vivo todavía NO está guardado. Si la llamada se corta antes
// de persistir la sesión, el descuento que vio el alumno no se materializa.

const formatCountdown = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

const Shell = ({
  tone,
  icon,
  label,
  value,
}: {
  tone: "neutral" | "success" | "warning";
  icon: React.ReactNode;
  label: string;
  value?: string;
}) => {
  const toneClasses = {
    neutral: "bg-background/80 border-border text-foreground",
    success: "bg-primary/10 border-primary/30 text-primary",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  }[tone];

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur ${toneClasses}`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
        {value && <p className="text-sm font-bold tabular-nums">{value}</p>}
      </div>
    </div>
  );
};

interface ExamUnlockCountdownProps {
  /** Modo derivado del escenario en curso. `undefined` = agente no reconocido. */
  practiceMode: PracticeMode | undefined;
  /** Práctica YA guardada, desglosada por modo. */
  timeByMode: TimeByMode;
  /** Segundos de la llamada en curso (aún sin guardar). */
  liveSeconds: number;
  minPracticeSecondsProspeccion: number;
  minPracticeSecondsObjeciones: number;
  examenFinalEnabled: boolean;
  examenObjecionesEnabled: boolean;
  practiceBypass: boolean;
}

export default function ExamUnlockCountdown({
  practiceMode,
  timeByMode,
  liveSeconds,
  minPracticeSecondsProspeccion,
  minPracticeSecondsObjeciones,
  examenFinalEnabled,
  examenObjecionesEnabled,
  practiceBypass,
}: ExamUnlockCountdownProps) {
  // Escenario no reconocido: no afirmamos nada. Que no sume es un hueco de
  // clasificación, no una decisión de producto — avisar acá sería alarmar de más.
  if (!practiceMode) return null;

  if (practiceMode === "asesor" || practiceMode === "coach") {
    return (
      <Shell
        tone="warning"
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Esta práctica no suma a ningún examen"
      />
    );
  }

  const isObjeciones = practiceMode === "objeciones";
  const minPracticeSeconds = isObjeciones
    ? minPracticeSecondsObjeciones
    : minPracticeSecondsProspeccion;
  const savedSeconds = isObjeciones
    ? timeByMode.roleplayObjecionesSeconds
    : timeByMode.roleplayClienteSeconds;

  const gate = evaluateExamGate({
    isAdmin: false,
    examEnabled: isObjeciones ? examenObjecionesEnabled : examenFinalEnabled,
    practiceBypass,
    practiceSeconds: savedSeconds + liveSeconds,
    minPracticeSeconds,
  });

  // Sin umbral configurado no hay cuenta regresiva que mostrar: ese examen lo
  // abre el instructor a mano, y un cartel acá sería ruido durante la llamada.
  if (!gate.hasAutoUnlock) return null;

  const examLabel = isObjeciones ? "Objeciones" : "Prospección";

  if (gate.remainingSeconds === 0) {
    return (
      <Shell
        tone="success"
        icon={<CheckCircle2 className="h-4 w-4" />}
        label={`Examen de ${examLabel} habilitado`}
      />
    );
  }

  return (
    <Shell
      tone="neutral"
      icon={<Timer className="h-4 w-4 text-muted-foreground" />}
      label={`Para habilitar examen · ${examLabel}`}
      value={formatCountdown(gate.remainingSeconds)}
    />
  );
}
