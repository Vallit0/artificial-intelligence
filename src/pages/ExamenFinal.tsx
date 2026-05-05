import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { useAuth } from "@/hooks/useAuth";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import AICompanionOrb from "@/components/AICompanionOrb";
import VoiceControls from "@/components/VoiceControls";
import EvaluationScreen from "@/components/practice/EvaluationScreen";
import LevelUpAnimation from "@/components/LevelUpAnimation";
import { useToast } from "@/hooks/use-toast";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api-client";

interface TranscriptMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

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

type ExamState = "idle" | "active" | "evaluating" | "evaluated" | "leveling-up";

export default function ExamenFinal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, refreshUser, patchUser } = useAuth();
  const { savePracticeSession, evaluateSession } = usePracticeSessions();
  const [examState, setExamState] = useState<ExamState>("idle");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionDurationRef = useRef(0);

  const isLocked = !isAdmin && !user?.examenFinalEnabled;

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    setTranscriptMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        isUser,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleError = useCallback((error: string) => {
    toast({
      variant: "destructive",
      title: "Error de conexión",
      description: error,
    });
  }, [toast]);

  const handleAgentEvaluation = useCallback((evalResult: EvaluationResult) => {
    console.log("[DEBUG][EVAL][ExamenFinal] handleAgentEvaluation invoked with:", evalResult);
    handleEndExamRef.current(evalResult);
  }, []);

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    sessionTime,
    getLatencyReport,
    connect,
    disconnect,
    toggleMute,
    awaitEvaluationPersist,
  } = useElevenLabsConversation({
    agentSecretName: "ELEVENLABS_AGENT_EXAMEN_FINAL",
    sessionId: currentSessionId,
    userId: user?.id || null,
    userName: user?.firstName || null,
    onTranscript: handleTranscript,
    onEvaluation: handleAgentEvaluation,
    onError: handleError,
    onAgentDisconnected: () => {
      handleEndExamRef.current();
    },
  });

  sessionDurationRef.current = sessionTime;

  const handleStartExam = async () => {
    setTranscriptMessages([]);
    setEvaluation(null);

    const sessionId = await savePracticeSession(0);
    setCurrentSessionId(sessionId);

    setExamState("active");
    await connect();
  };

  const handleEndExam = useCallback(async (preEvaluation?: EvaluationResult) => {
    await disconnect();

    const sessionId = currentSessionId;
    const duration = sessionDurationRef.current;
    const transcript = transcriptMessages;

    if (sessionId) {
      try {
        const latency = getLatencyReport();
        await api.patch(`/api/sessions/${sessionId}`, {
          durationSeconds: duration,
          connectMs: latency.connectMs,
          ttfaSamplesMs: latency.ttfaSamplesMs,
        });
      } catch (err) {
        console.error("Failed to update session duration:", err);
      }

      if (transcript.length > 0) {
        api.post(`/api/sessions/${sessionId}/transcript`, {
          transcript: transcript.map((m) => ({
            role: m.isUser ? "user" : "agent",
            content: m.text,
            timestamp: m.timestamp.getTime(),
          })),
        }).catch((err) => console.error("Failed to save transcript:", err));
      }
    }

    if (!sessionId) {
      setExamState("idle");
      return;
    }

    if (preEvaluation) {
      setEvaluation(preEvaluation);
      setExamState("evaluated");
      return;
    }

    setExamState("evaluating");

    const result = await evaluateSession(
      sessionId,
      transcript.map((m) => ({
        role: m.isUser ? "user" : "agent",
        content: m.text,
        timestamp: m.timestamp.getTime(),
      })),
      null,
      duration,
    );

    if (result) {
      setEvaluation(result);
      setExamState("evaluated");
    } else {
      toast({
        variant: "destructive",
        title: "No se pudo evaluar",
        description: "Hubo un problema al calcular tu punteo. Intenta de nuevo.",
      });
      setExamState("idle");
    }
  }, [disconnect, currentSessionId, transcriptMessages, evaluateSession, getLatencyReport, toast]);

  const handleEndExamRef = useRef(handleEndExam);
  handleEndExamRef.current = handleEndExam;

  const handleRetry = () => {
    setEvaluation(null);
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setExamState("idle");
  };

  const handleContinue = async () => {
    if (evaluation?.passed) {
      try {
        // The agent submits its evaluation via a fire-and-forget POST to
        // /api/elevenlabs/agent-evaluation; unlock-level2 reads `passed`
        // straight from that session row, so we must wait for the persist
        // to land before requesting the unlock or we race into a 403.
        await awaitEvaluationPersist?.();
        const res = await api.post<{ success: boolean; level2Unlocked: boolean }>(
          "/api/users/me/unlock-level2",
          {},
        );
        // Patch local user state from the mutation response so the sidebar
        // flips to Level 2 even if a stale /auth/me (ETag/304) would have
        // otherwise returned the pre-unlock body.
        if (res?.level2Unlocked) {
          patchUser({ level2Unlocked: true });
        }
        // Best-effort sync of the rest of the user shape — not required for
        // the level switch, so we don't fail the flow if it errors.
        refreshUser().catch(() => {});
      } catch (err) {
        console.error("Failed to unlock Level 2:", err);
        const detail = err instanceof Error && err.message
          ? err.message
          : "Hubo un problema al desbloquear el siguiente nivel. Intentá de nuevo en unos segundos.";
        toast({
          variant: "destructive",
          title: "No se pudo desbloquear el Nivel 2",
          description: detail,
        });
        return;
      }
      setExamState("leveling-up");
      return;
    }
    setEvaluation(null);
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setExamState("idle");
    navigate("/progress");
  };

  const finishLevelUp = () => {
    setEvaluation(null);
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setExamState("idle");
    navigate("/practice");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (examState === "leveling-up") {
    return <LevelUpAnimation onDone={finishLevelUp} />;
  }

  if (examState === "evaluating" || examState === "evaluated") {
    return (
      <EvaluationScreen
        isEvaluating={examState === "evaluating"}
        evaluation={evaluation}
        scenarioName="Examen Final"
        sessionDuration={sessionDurationRef.current}
        onContinue={handleContinue}
        onRetry={handleRetry}
        continueLabel={evaluation?.passed ? "Avanzar de nivel" : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen animate-fade-in">
        <ScrollArea className="h-screen">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground">Examen Final</h1>
                <p className="text-muted-foreground">Demuestra tus habilidades de venta</p>
              </div>
            </div>

            {isLocked ? (
              /* Locked State */
              <Card className="border-muted">
                <CardHeader className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-2xl">Examen Final Bloqueado</CardTitle>
                  <CardDescription className="text-base max-w-lg mx-auto">
                    Tu examen final aún no ha sido habilitado. Contacta a tu instructor o administrador
                    para que te habilite el acceso cuando estés listo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="bg-muted/50 rounded-lg p-4 w-full max-w-md">
                    <h3 className="font-semibold mb-2 text-center">Mientras tanto...</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Sigue practicando con los escenarios de prospección y llamadas para prepararte
                      para tu evaluación final.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/practice")}>
                    Ir a Practicar
                  </Button>
                </CardContent>
              </Card>
            ) : examState === "idle" ? (
              /* Instructions Card */
              <Card className="border-primary/20">
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <GraduationCap className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">¿Listo para tu examen final?</CardTitle>
                  <CardDescription className="text-base max-w-lg mx-auto">
                    Este examen evaluará todas las habilidades que has desarrollado durante el curso.
                    Tendrás una conversación con un cliente potencial y deberás aplicar las técnicas aprendidas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Warning */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Importante
                      </p>
                      <p className="text-muted-foreground">
                        Asegúrate de estar en un lugar tranquilo y tener tu micrófono listo.
                        Una vez iniciado, el examen no se puede pausar.
                      </p>
                    </div>
                  </div>

                  {/* Evaluation Criteria */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Criterios de evaluación:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Apertura y presentación
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Escucha activa
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Manejo de objeciones
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Propuesta de valor
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Técnica de cierre
                      </li>
                    </ul>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleStartExam}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Conectando..." : "Comenzar Examen"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Exam in Progress */
              <div className="space-y-6">
                {/* Status Bar */}
                <div className="flex items-center justify-between bg-card border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-muted"}`} />
                    <span className="text-sm font-medium">
                      {isConnected ? "Examen en curso" : "Conectando..."}
                    </span>
                  </div>
                  <div className="text-lg font-mono font-bold text-primary">
                    {formatTime(sessionTime)}
                  </div>
                </div>

                {/* Voice Orb */}
                <div className="flex justify-center py-8">
                  <AICompanionOrb
                    energy
                    size="lg"
                    speaking={isSpeaking}
                    listening={isConnected && !isSpeaking}
                    gradient="radial-gradient(circle at 40% 40%, #f87171, #ef4444, #b91c1c, #7f1d1d)"
                  />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center pt-4">
                  <VoiceControls
                    isMuted={isMuted}
                    onMuteToggle={toggleMute}
                    onEndCall={handleEndExam}
                    disabled={!isConnected}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

       {/* Mobile Bottom Navigation */}
       <MobileNavigation />
    </div>
  );
}
