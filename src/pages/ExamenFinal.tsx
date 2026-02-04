import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, AlertTriangle, Mic, MicOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import LiveTranscript from "@/components/LiveTranscript";
import VoiceOrb from "@/components/VoiceOrb";
import { useToast } from "@/hooks/use-toast";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ExamenFinal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasStarted, setHasStarted] = useState(false);
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);

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

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    sessionTime,
    connect,
    disconnect,
    toggleMute,
  } = useElevenLabsConversation({
    agentSecretName: "ELEVENLABS_AGENT_EXAMEN_FINAL",
    onTranscript: handleTranscript,
    onError: handleError,
  });

  const handleStartExam = async () => {
    setHasStarted(true);
    setTranscriptMessages([]);
    await connect();
  };

  const handleEndExam = async () => {
    await disconnect();
    setHasStarted(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-56 min-h-screen">
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
              <div>
                <h1 className="text-2xl font-bold text-foreground">Examen Final</h1>
                <p className="text-muted-foreground">Demuestra tus habilidades de venta</p>
              </div>
            </div>

            {!hasStarted ? (
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
                  <VoiceOrb isListening={isConnected && !isSpeaking} isSpeaking={isSpeaking} size="lg" />
                </div>

                {/* Transcript */}
                <Card className="h-64">
                  <CardContent className="p-0 h-full">
                    <LiveTranscript messages={transcriptMessages} />
                  </CardContent>
                </Card>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={toggleMute}
                    disabled={!isConnected}
                    className="gap-2"
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {isMuted ? "Activar Mic" : "Silenciar"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={handleEndExam}
                    className="gap-2"
                  >
                    <Phone className="h-5 w-5" />
                    Terminar Examen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-3 px-4 lg:hidden shadow-lg">
        <div className="flex items-center justify-around">
          <MobileNavItem icon="users" label="Prospectar" href="/prospecting" />
          <MobileNavItem icon="mic" label="Práctica" href="/practice" />
          <MobileNavItem icon="target" label="Evaluación" href="/quests" active />
          <MobileNavItem icon="chart" label="Progreso" href="/progress" />
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({
  icon,
  label,
  href,
  active,
}: {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
}) {
  const getIcon = () => {
    switch (icon) {
      case "users":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case "mic":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        );
      case "target":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <circle cx="12" cy="12" r="6" strokeWidth={2} />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        );
      case "chart":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <a
      href={href}
      className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 ${
        active 
          ? "text-secondary bg-secondary/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {getIcon()}
      <span className="text-xs font-semibold">{label}</span>
    </a>
  );
}
