import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { FreeTierTimer } from "@/components/practice/FreeTierTimer";
import { TimeUpModal } from "@/components/practice/TimeUpModal";
import AICompanionOrb from "@/components/AICompanionOrb";
import VoiceControls from "@/components/VoiceControls";
import logoSenoriales from "@/assets/logo-senoriales.png";

type SessionState = "idle" | "connecting" | "active" | "timeup";

const FREE_TIER_MAX_SECONDS = 180; // 3 minutes

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const [orbGrowing, setOrbGrowing] = useState(false);
  const [orbWinking, setOrbWinking] = useState(false);
  const [textIndex, setTextIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const [headerText, setHeaderText] = useState("");

  const rotatingTexts = [
    { title: "Álvaro", subtitle: "Tu coach personal de ventas" },
    { title: "Centro de Negocios Digital", subtitle: "Señoriales Corporación de Servicio" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % rotatingTexts.length);
        setTextVisible(true);
      }, 600);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fullText = "Centro de Negocios Señoriales";
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setHeaderText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, []);

  const isInSession = sessionState !== "idle";

  const handleTranscript = useCallback((_text: string, _isUser: boolean) => {
    // transcript not displayed on landing
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

  // Transition to active when connected
  if (isConnected && sessionState === "connecting") {
    setSessionState("active");
    setConnectionStatus("Conectado");
  }

  if (isConnecting && !connectionStatus) {
    setConnectionStatus("Conectando con el agente...");
  }

  const handleStart = () => {
    // Step 1: grow the orb
    setOrbGrowing(true);

    // Step 2: wink after it grows
    setTimeout(() => setOrbWinking(true), 400);

    // Step 3: fade out the rest and connect
    setTimeout(() => {
      setFadeOut(true);
    }, 800);

    setTimeout(() => {
      setSessionState("connecting");
      setConnectionStatus("Solicitando permisos de micrófono...");
      setOrbGrowing(false);
      setOrbWinking(false);
      connect();
    }, 1400);
  };

  const handleEndCall = () => {
    disconnect();
    setSessionState("idle");
    setFadeOut(false);
    setOrbGrowing(false);
    setOrbWinking(false);
    setConnectionStatus("");
    setTranscriptMessages([]);
  };

  const handleTimeUp = useCallback(() => {
    disconnect();
    setSessionState("timeup");
  }, [disconnect]);

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
            className="h-10 w-auto"
          />
          <span className="text-xl font-bold text-foreground">
            {headerText}
            <span className="inline-block w-[2px] h-5 bg-foreground ml-0.5 animate-pulse" />
          </span>
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
            {/* Orb hero + logo */}
            <button
              onClick={handleStart}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                "relative flex flex-col items-center justify-center group transition-all duration-500",
                fadeOut ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100 animate-fade-in"
              )}
            >
              <div
                className="transition-transform duration-500 ease-out"
                style={{
                  transform: orbGrowing ? "scale(1.5)" : isHovered ? "scale(1.05)" : "scale(1)",
                }}
              >
                <AICompanionOrb size="lg" listening={false} speaking={false} winkOut={orbWinking} onWinkOutDone={() => {}} />
              </div>
              <div
                className="text-center mt-4 h-16 flex flex-col justify-center transition-all duration-500 ease-in-out"
                style={{
                  opacity: textVisible ? 1 : 0,
                  transform: textVisible ? "translateY(0)" : "translateY(8px)",
                }}
              >
                <h2
                  className="text-2xl font-extrabold text-foreground mb-1"
                  style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                >
                  {rotatingTexts[textIndex].title}
                </h2>
                <p className="text-sm font-semibold text-muted-foreground">
                  {rotatingTexts[textIndex].subtitle}
                </p>
              </div>
              <img
                src={logoSenoriales}
                alt="Centro de Negocios Señoriales"
                className="h-12 w-auto mt-4 opacity-80"
              />
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

                <AICompanionOrb energy speaking={isSpeaking} listening={!isMuted} size={isMobile ? "sm" : "lg"} />

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
                <AICompanionOrb energy speaking={false} listening={false} size={isMobile ? "sm" : "lg"} />
                <p className="text-sm text-muted-foreground">Preparando sesión...</p>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
};

export default Landing;
