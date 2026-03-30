import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, Users, Loader2, Wifi, WifiOff, MessageSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { useScribeRealtime } from "@/hooks/useScribeRealtime";
import { FreeTierTimer } from "@/components/practice/FreeTierTimer";
import { TimeUpModal } from "@/components/practice/TimeUpModal";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LiveTranscript from "@/components/LiveTranscript";
import MobileTranscriptSheet from "@/components/practice/MobileTranscriptSheet";
import logoSenoriales from "@/assets/logo-senoriales.png";

type SessionState = "idle" | "connecting" | "active" | "timeup";

interface TranscriptMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const FREE_TIER_MAX_SECONDS = 180; // 3 minutes

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  const isInSession = sessionState !== "idle";

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    setTranscriptMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, isUser, timestamp: new Date() },
    ]);
  }, []);

  const handleError = useCallback((error: string) => {
    toast({ variant: "destructive", title: "Error de conexión", description: error });
    setSessionState("idle");
    setFadeOut(false);
    setConnectionStatus("");
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
    onTranscript: handleTranscript,
    onError: handleError,
  });

  const {
    isConnected: isScribeConnected,
    partialTranscript,
    connect: connectScribe,
    disconnect: disconnectScribe,
    clearTranscripts,
  } = useScribeRealtime({
    onCommittedTranscript: (text) => {
      setTranscriptMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}-${Math.random()}`, text, isUser: true, timestamp: new Date() },
      ]);
    },
  });

  // Transition to active when connected
  if (isConnected && sessionState === "connecting") {
    setSessionState("active");
    setConnectionStatus("Conectado");
  }

  if (isConnecting && !connectionStatus) {
    setConnectionStatus("Conectando con el agente...");
  }

  const handleStart = () => {
    setFadeOut(true);
    // Wait for fade out animation, then connect
    setTimeout(() => {
      setSessionState("connecting");
      setConnectionStatus("Solicitando permisos de micrófono...");
      setTranscriptMessages([]);
      clearTranscripts();
      connect();
      connectScribe();
    }, 500);
  };

  const handleEndCall = () => {
    disconnect();
    disconnectScribe();
    setSessionState("idle");
    setFadeOut(false);
    setConnectionStatus("");
    setTranscriptMessages([]);
  };

  const handleTimeUp = useCallback(() => {
    disconnect();
    disconnectScribe();
    setSessionState("timeup");
  }, [disconnect, disconnectScribe]);

  // Time up modal
  if (sessionState === "timeup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <TimeUpModal open={true} characterName="Álvaro" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header
        className={cn(
          "flex items-center justify-between px-6 py-4 transition-all duration-500",
          fadeOut && !isInSession && "opacity-0 -translate-y-4",
          isInSession && "opacity-100 translate-y-0"
        )}
      >
        <div className="flex items-center gap-4">
          <img
            src={logoSenoriales}
            alt="Centro de Negocios Señoriales"
            className="h-14 w-auto"
          />
          <span className="text-xl font-bold text-foreground">Centro de Negocios Señoriales</span>
        </div>
        {!isInSession ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/auth")}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Iniciar Sesión
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            {sessionState === "active" && (
              <FreeTierTimer
                maxSeconds={FREE_TIER_MAX_SECONDS}
                currentSeconds={sessionTime}
                onTimeUp={handleTimeUp}
              />
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12 relative">

        {/* ===== LANDING CONTENT (fades out) ===== */}
        {!isInSession && (
          <>
            {/* Logo button */}
            <button
              onClick={handleStart}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                "relative flex flex-col items-center justify-center group transition-all duration-500",
                fadeOut ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100 animate-fade-in"
              )}
            >
              <div className="relative w-80 h-80 flex flex-col items-center justify-center">
                {/* Circle */}
                <div
                  className={cn(
                    "absolute rounded-full bg-turquoise transition-all duration-300 ease-in-out",
                    "w-48 h-48 top-4",
                    isHovered && "scale-110 shadow-lg"
                  )}
                />
                {/* Triangle */}
                <div
                  className="absolute transition-all duration-300 ease-in-out"
                  style={{ top: "70px" }}
                >
                  <svg
                    width="200"
                    height="140"
                    viewBox="0 0 180 130"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={cn("transition-transform duration-300", isHovered && "translate-y-1")}
                  >
                    <path d="M90 10 L175 125 L5 125 Z" className="fill-turquoise" />
                    <path d="M90 10 L5 125" stroke="hsl(var(--background))" strokeWidth="6" />
                    <path d="M90 10 L175 125" stroke="hsl(var(--background))" strokeWidth="6" />
                  </svg>
                </div>
                {/* Text */}
                <div className="absolute bottom-0 text-center">
                  <h2
                    className="text-2xl font-extrabold text-foreground mb-1"
                    style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                  >
                    Álvaro
                  </h2>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Tu coach personal de ventas
                  </p>
                </div>
              </div>
            </button>

            {/* CTA Buttons */}
            <div
              className={cn(
                "flex flex-col gap-3 w-full max-w-xs mt-6 transition-all duration-500",
                fadeOut ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0 animate-fade-in"
              )}
              style={{ animationDelay: "0.2s" }}
            >
              <Button
                onClick={handleStart}
                className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider shadow-[0_4px_0_0_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.4)] hover:translate-y-[2px] transition-all"
              >
                Empezar Ahora
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/prospecting")}
                className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider shadow-[0_4px_0_0_hsl(var(--secondary)/0.4)] hover:shadow-[0_2px_0_0_hsl(var(--secondary)/0.4)] hover:translate-y-[2px] transition-all gap-2"
              >
                <Users className="w-5 h-5" />
                Escenarios de Prospección
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/auth")}
                className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-wider border-2 border-border shadow-[0_4px_0_0_hsl(var(--border))] hover:shadow-[0_2px_0_0_hsl(var(--border))] hover:translate-y-[2px] transition-all"
              >
                Ya Tengo Una Cuenta
              </Button>
            </div>

            {/* Free tier notice */}
            <div
              className={cn(
                "text-center mt-6 transition-all duration-500",
                fadeOut ? "opacity-0" : "opacity-100 animate-fade-in"
              )}
              style={{ animationDelay: "0.3s" }}
            >
              <p className="text-sm font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  3 minutos gratis para probar
                </span>
              </p>
            </div>
          </>
        )}

        {/* ===== IN-SESSION CONTENT (fades in) ===== */}
        {isInSession && (
          <div className="flex flex-col items-center justify-center w-full h-full animate-fade-in">
            {/* Connection status */}
            {connectionStatus && sessionState === "connecting" && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full mb-6">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-semibold text-muted-foreground">{connectionStatus}</span>
              </div>
            )}

            {/* Active session UI */}
            {sessionState === "active" && (
              <div className="flex flex-col items-center gap-3 sm:gap-6">
                <p
                  className="text-xs sm:text-base font-bold text-muted-foreground text-center px-4"
                  style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                >
                  Hablando con Álvaro (Coach)
                </p>

                <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} size={isMobile ? "sm" : "lg"} />

                {/* Partial transcript on mobile */}
                {isMobile && partialTranscript && (
                  <div className="max-w-[280px] bg-muted/50 rounded-xl px-3 py-2 animate-pulse">
                    <p className="text-xs text-muted-foreground italic truncate">{partialTranscript}</p>
                  </div>
                )}

                <VoiceControls
                  isMuted={isMuted}
                  onMuteToggle={toggleMute}
                  onEndCall={handleEndCall}
                />
              </div>
            )}

            {/* Connecting state - show loading orb */}
            {sessionState === "connecting" && (
              <div className="flex flex-col items-center gap-4">
                <VoiceOrb isSpeaking={false} isListening={false} size={isMobile ? "sm" : "lg"} />
                <p className="text-sm text-muted-foreground">Preparando sesión...</p>
              </div>
            )}

            {/* Desktop transcript panel */}
            {!isMobile && sessionState === "active" && showTranscript && (
              <div className="w-80 h-[400px] bg-card border-2 border-border rounded-2xl flex flex-col shadow-[0_4px_0_0_hsl(var(--border))] absolute right-6 top-1/2 -translate-y-1/2">
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                    >
                      Transcripción
                    </span>
                    {isScribeConnected && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 font-bold"
                    onClick={() => setShowTranscript(false)}
                  >
                    ×
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LiveTranscript
                    messages={
                      partialTranscript
                        ? [
                            ...transcriptMessages,
                            { id: "partial", text: partialTranscript + "...", isUser: true, timestamp: new Date() },
                          ]
                        : transcriptMessages
                    }
                  />
                </div>
              </div>
            )}

            {/* Desktop toggle transcript button */}
            {!isMobile && sessionState === "active" && !showTranscript && (
              <Button
                variant="outline"
                size="sm"
                className="absolute bottom-6 right-6 rounded-xl font-bold uppercase tracking-wider border-2 z-10"
                onClick={() => setShowTranscript(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Mostrar transcripción
              </Button>
            )}

            {/* Mobile transcript sheet */}
            {isMobile && sessionState === "active" && (
              <MobileTranscriptSheet
                messages={transcriptMessages}
                partialTranscript={partialTranscript}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Landing;
