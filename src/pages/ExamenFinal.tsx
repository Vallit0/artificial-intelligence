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
 import MobileNavigation from "@/components/MobileNavigation";
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
       <MobileNavigation />
    </div>
  );
}

