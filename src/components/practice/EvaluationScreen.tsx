import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Star, Lock, Unlock, Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  breakdown?: {
    apertura: number;
    escucha_activa: number;
    manejo_objeciones: number;
    propuesta_valor: number;
    cierre: number;
  };
}

interface EvaluationScreenProps {
  isEvaluating: boolean;
  evaluation: EvaluationResult | null;
  scenarioName?: string;
  sessionDuration: number;
  onContinue: () => void;
  onRetry: () => void;
}

const EvaluationScreen = ({
  isEvaluating,
  evaluation,
  scenarioName,
  sessionDuration,
  onContinue,
  onRetry,
}: EvaluationScreenProps) => {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Trigger confetti on pass
  useEffect(() => {
    if (evaluation?.passed) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#009C96", "#7CB342", "#FFD54F"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#009C96", "#7CB342", "#FFD54F"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [evaluation?.passed]);

  const breakdownLabels: Record<string, string> = {
    apertura: "Apertura",
    escucha_activa: "Escucha Activa",
    manejo_objeciones: "Manejo de Objeciones",
    propuesta_valor: "Propuesta de Valor",
    cierre: "Cierre",
  };

  if (isEvaluating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 animate-fade-in">
        <div className="bg-card border-2 border-border rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-[0_4px_0_0_hsl(var(--border))] text-center">
          <Loader2 className="w-16 h-16 text-secondary animate-spin mx-auto mb-6" />
          <h1 
            className="text-xl sm:text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            Evaluando tu sesión...
          </h1>
          <p className="text-muted-foreground">
            La IA está analizando tu conversación
          </p>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 animate-fade-in">
        <div className="bg-card border-2 border-border rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-[0_4px_0_0_hsl(var(--border))] text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
          <h1 
            className="text-xl sm:text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            Error al evaluar
          </h1>
          <p className="text-muted-foreground mb-6">
            No se pudo evaluar tu sesión. Por favor intenta de nuevo.
          </p>
          <Button onClick={() => navigate("/scenarios")} className="w-full rounded-xl font-bold">
            Volver a escenarios
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4 py-8 animate-fade-in">
      <div className="bg-card border-2 border-border rounded-3xl p-6 sm:p-10 w-full max-w-md shadow-[0_4px_0_0_hsl(var(--border))]">
        {/* Header with result */}
        <div className="text-center mb-6">
          {evaluation.passed ? (
            <>
              <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-secondary" />
              </div>
              <h1 
                className="text-2xl sm:text-3xl font-bold text-secondary mb-1"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                ¡Misión Completada!
              </h1>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Unlock className="w-4 h-4" />
                <span className="text-sm font-medium">Siguiente escenario desbloqueado</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Lock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h1 
                className="text-2xl sm:text-3xl font-bold text-foreground mb-1"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                ¡Sigue practicando!
              </h1>
              <p className="text-sm text-muted-foreground">
                Necesitas 50+ puntos para pasar
              </p>
            </>
          )}
        </div>

        {/* Score display */}
        <div className="bg-muted rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-foreground">Tu puntaje</span>
            <span 
              className={cn(
                "text-3xl font-bold",
                evaluation.passed ? "text-secondary" : "text-foreground"
              )}
            >
              {evaluation.score}/100
            </span>
          </div>
          <Progress 
            value={evaluation.score} 
            className={cn(
              "h-4",
              evaluation.passed ? "[&>div]:bg-secondary" : "[&>div]:bg-muted-foreground"
            )}
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0</span>
            <span className="text-secondary font-bold">50 (mínimo)</span>
            <span>100</span>
          </div>
        </div>

        {/* Feedback */}
        <div className="bg-background border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-foreground leading-relaxed">
            {evaluation.feedback}
          </p>
        </div>

        {/* Breakdown toggle */}
        {evaluation.breakdown && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-sm text-secondary font-bold mb-4 hover:underline"
          >
            {showDetails ? "Ocultar detalles" : "Ver desglose de puntaje"}
          </button>
        )}

        {/* Breakdown details */}
        {showDetails && evaluation.breakdown && (
          <div className="space-y-3 mb-6 animate-fade-in">
            {Object.entries(evaluation.breakdown).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {breakdownLabels[key] || key}
                </span>
                <div className="flex items-center gap-2">
                  <Progress value={value * 5} className="w-20 h-2" />
                  <span className="text-sm font-bold text-foreground w-8 text-right">
                    {value}/20
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session info */}
        {sessionDuration > 0 && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Duración: {formatDuration(sessionDuration)}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {evaluation.passed ? (
            <Button 
              onClick={onContinue} 
              className="w-full rounded-xl font-bold uppercase tracking-wider h-12"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Continuar
            </Button>
          ) : (
            <>
              <Button 
                onClick={onRetry} 
                className="w-full rounded-xl font-bold uppercase tracking-wider h-12"
              >
                Intentar de nuevo
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/scenarios")} 
                className="w-full rounded-xl font-bold uppercase tracking-wider h-12 border-2"
              >
                Volver a escenarios
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationScreen;
