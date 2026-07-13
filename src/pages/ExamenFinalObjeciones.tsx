import { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, AlertTriangle, Award, FileImage, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { useAuth } from "@/hooks/useAuth";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import AICompanionOrb from "@/components/AICompanionOrb";
import VoiceControls from "@/components/VoiceControls";
import EvaluationScreen from "@/components/practice/EvaluationScreen";
import CertificatePreview from "@/components/admin/CertificatePreview";
import { useToast } from "@/hooks/use-toast";
import { usePlatformConfig } from "@/hooks/useAppConfig";
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
  // Desglose por paso del método de replanteamiento de objeciones (Investigar,
  // Aislar, Responder, Continuar), con su resultado, para mostrar en pantalla.
  checklist?: { label: string; passed: boolean }[];
}

type ExamState = "idle" | "active" | "evaluating" | "evaluated" | "certificate";

// Examen de Objeciones: la llamada se cierra (y evalúa) al llegar a 10 min.
const EXAM_MAX_SECONDS = 10 * 60;

export default function ExamenFinalObjeciones() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, refreshUser, patchUser } = useAuth();
  const { sessions, savePracticeSession, evaluateSession } = usePracticeSessions();
  const [examState, setExamState] = useState<ExamState>("idle");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionDurationRef = useRef(0);
  const certificateRef = useRef<HTMLDivElement>(null);

  // Duración y umbral configurables por el admin (AppConfig); fallback a los
  // defaults históricos de Objeciones mientras la config carga.
  const { config: platformConfig } = usePlatformConfig();
  const examMaxSeconds = platformConfig?.callDurationObjecionesSec ?? EXAM_MAX_SECONDS;
  const passThreshold = platformConfig?.passThresholdObjeciones ?? 80;

  // Tiempo de práctica de Objeciones acumulado (excluye intentos de examen).
  const practiceSeconds = useMemo(
    () =>
      sessions
        .filter((s) => !s.exam_type && s.practice_mode === "objeciones")
        .reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
    [sessions],
  );
  const minPracticeSeconds = platformConfig?.minPracticeSecondsObjeciones ?? 0;
  const needsMorePractice = !isAdmin && practiceSeconds < minPracticeSeconds;
  const missingPracticeMin = Math.ceil((minPracticeSeconds - practiceSeconds) / 60);

  // Gate: el examen de Objeciones está bloqueado hasta que un admin o el coach
  // asignado lo habilite (flag examenObjecionesEnabled) Y el alumno cumpla el
  // tiempo mínimo de práctica configurado. El admin lo ve siempre.
  const isLocked = !isAdmin && (!user?.examenObjecionesEnabled || needsMorePractice);

  const studentName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Estudiante";

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
    console.log("[DEBUG][EVAL][ExamenFinalObjeciones] handleAgentEvaluation invoked with:", evalResult);
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
  } = useElevenLabsConversation({
    agentSecretName: "ELEVENLABS_AGENT_EXAMEN_FINAL_NIVEL2",
    sessionId: currentSessionId,
    userId: user?.id || null,
    userName: user?.firstName || null,
    // Umbral de aprobación configurable (default Objeciones=80).
    passThreshold,
    onTranscript: handleTranscript,
    onEvaluation: handleAgentEvaluation,
    onError: handleError,
    onAgentDisconnected: () => {
      handleEndExamRef.current();
    },
    maxDurationSec: examMaxSeconds,
    onMaxDuration: () => {
      handleEndExamRef.current();
    },
  });

  sessionDurationRef.current = sessionTime;

  const handleStartExam = async () => {
    setTranscriptMessages([]);
    setEvaluation(null);

    const sessionId = await savePracticeSession(0, undefined, undefined, undefined, "objeciones");
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
        role: m.isUser ? ("user" as const) : ("assistant" as const),
        content: m.text,
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
      // Marca el programa como completado (idempotente) y refleja el flag en
      // el estado local para que /progress y el resto de la UI lo vean sin
      // depender de un /auth/me potencialmente cacheado (ETag/304).
      try {
        const res = await api.post<{ success: boolean; courseCompleted: boolean }>(
          "/api/users/me/complete-course",
          {},
        );
        if (res?.courseCompleted) {
          patchUser({ courseCompleted: true });
        }
        refreshUser().catch(() => {});
      } catch (err) {
        console.error("Failed to mark course completed:", err);
        // No bloqueamos el certificado por esto — el alumno ya aprobó. Sólo
        // avisamos para que reintente si quiere persistir el estado.
        toast({
          variant: "destructive",
          title: "No se pudo guardar tu finalización",
          description: "Igual puedes descargar tu certificado. Vuelve a intentar más tarde para registrarlo.",
        });
      }
      setExamState("certificate");
      return;
    }
    setEvaluation(null);
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setExamState("idle");
    navigate("/progress");
  };

  const downloadCertificate = async (kind: "png" | "pdf") => {
    if (!certificateRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const safeName = studentName.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "estudiante";

      if (kind === "png") {
        const link = document.createElement("a");
        link.download = `certificado-${safeName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width / 2, canvas.height / 2],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`certificado-${safeName}.pdf`);
      }

      toast({
        title: "Certificado descargado",
        description: `Se guardó como ${kind.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el certificado. Intenta de nuevo.",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (examState === "certificate") {
    return (
      <div className="min-h-screen bg-background">
        <LeftSidebar />
        <main className="ml-60 min-h-screen animate-fade-in">
          <ScrollArea className="h-screen">
            <div className="max-w-4xl mx-auto px-4 py-8">
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">¡Felicidades, {user?.firstName || studentName}!</h1>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Completaste el examen final de Manejo de Objeciones. Aquí está tu certificado de finalización.
                </p>
              </div>

              {/* El certificado mide 800px fijos (necesario para la captura
                  html2canvas). En móvil escalamos SÓLO la vista: la caja
                  externa toma el tamaño escalado y el nodo interno queda a
                  800px para exportar en alta resolución. */}
              <div className="overflow-hidden bg-muted p-4 rounded-lg flex justify-center">
                <div className="w-[336px] h-[238px] sm:w-[600px] sm:h-[425px] md:w-[800px] md:h-[566px]">
                  <div className="origin-top-left scale-[0.42] sm:scale-[0.75] md:scale-100">
                    <CertificatePreview
                      ref={certificateRef}
                      level={2}
                      studentName={studentName}
                      grade={evaluation?.score ?? 0}
                      instructorName={platformConfig?.certificateInstructorName}
                      directorName={platformConfig?.certificateDirectorName}
                      courseName={platformConfig?.certificateCourseName}
                      instructorSignature={platformConfig?.certificateInstructorSignature}
                      directorSignature={platformConfig?.certificateDirectorSignature}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
                <Button variant="outline" onClick={() => navigate("/progress")}>
                  Ir a Mi Progreso
                </Button>
                <Button variant="secondary" onClick={() => downloadCertificate("png")}>
                  <FileImage className="w-4 h-4 mr-2" />
                  Descargar PNG
                </Button>
                <Button onClick={() => downloadCertificate("pdf")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          </ScrollArea>
        </main>
        <MobileNavigation />
      </div>
    );
  }

  if (examState === "evaluating" || examState === "evaluated") {
    return (
      <EvaluationScreen
        isEvaluating={examState === "evaluating"}
        evaluation={evaluation}
        scenarioName="Examen Final · Objeciones"
        sessionDuration={sessionDurationRef.current}
        onContinue={handleContinue}
        onRetry={handleRetry}
        continueLabel={evaluation?.passed ? "Ver mi certificado" : undefined}
        passThreshold={80}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="ml-60 min-h-screen animate-fade-in">
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
                <h1 className="text-2xl font-bold text-foreground">Examen Final · Objeciones</h1>
                <p className="text-muted-foreground">Demuestra tu dominio del manejo de objeciones</p>
              </div>
            </div>

            {isLocked ? (
              /* Locked State */
              <Card className="border-muted">
                <CardHeader className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-2xl">Examen de Objeciones Bloqueado</CardTitle>
                  <CardDescription className="text-base max-w-lg mx-auto">
                    {user?.examenObjecionesEnabled && needsMorePractice
                      ? `Necesitás acumular más tiempo de práctica de Objeciones antes de rendir. Te faltan aproximadamente ${missingPracticeMin} min de práctica.`
                      : "Tu examen de objeciones aún no ha sido habilitado. Contacta a tu instructor o administrador para que te habilite el acceso cuando estés listo."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="bg-muted/50 rounded-lg p-4 w-full max-w-md">
                    <h3 className="font-semibold mb-2 text-center">Mientras tanto...</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Sigue practicando el manejo de objeciones con los escenarios disponibles para
                      prepararte para tu evaluación final.
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
                  <CardTitle className="text-2xl">¿Listo para tu examen de objeciones?</CardTitle>
                  <CardDescription className="text-base max-w-lg mx-auto">
                    Este examen evaluará tu capacidad para manejar objeciones en una conversación real
                    con un cliente difícil. Al aprobarlo recibirás tu certificado de finalización del programa.
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
                        Replanteamiento de objeciones
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Investigar
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Aislar (identificar la objeción)
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Responder (3F · Historias de 3ras personas · Secuencias de cierre)
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Continuar
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
                    {formatTime(Math.max(0, examMaxSeconds - sessionTime))}
                  </div>
                </div>

                {/* Voice Orb */}
                <div className="flex justify-center py-8">
                  <AICompanionOrb
                    energy
                    size="lg"
                    speaking={isSpeaking}
                    listening={isConnected && !isSpeaking}
                    gradient="radial-gradient(circle at 40% 40%, #c084fc, #a855f7, #9333ea, #6b21a8)"
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
