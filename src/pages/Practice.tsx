import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LogoMorph from "@/components/LogoMorph";
import FeedbackScreen from "@/components/FeedbackScreen";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import LiveTranscript from "@/components/LiveTranscript";
import { FreeTierTimer } from "@/components/practice/FreeTierTimer";
import { TimeUpModal } from "@/components/practice/TimeUpModal";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wifi, WifiOff, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Scenario } from "@/hooks/useScenarios";

type SessionState = "idle" | "connecting" | "active" | "feedback" | "timeup";

interface TranscriptMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Character configurations
const characters: Record<string, { name: string; role: string; persona: string }> = {
  alvaro: {
    name: "Álvaro",
    role: "client",
    persona: "Cliente potencial interesado en servicios funerarios con dudas y objeciones típicas.",
  },
  lea: {
    name: "Lea",
    role: "coach",
    persona: "Coach de ventas que da feedback en tiempo real y consejos para mejorar.",
  },
};

const FREE_TIER_MAX_SECONDS = 180; // 3 minutes

const Practice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const scenarioId = searchParams.get("scenario");
  const characterId = searchParams.get("character");
  const tier = searchParams.get("tier");
  
  const isFreeTier = tier === "free" && !user;
  const character = characterId ? characters[characterId] : null;
  
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const sessionDurationRef = useRef<number>(0);
  const { savePracticeSession } = usePracticeSessions();

  // Fetch scenario details
  useEffect(() => {
    if (scenarioId) {
      supabase
        .from("scenarios")
        .select("*")
        .eq("id", scenarioId)
        .single()
        .then(({ data }) => {
          if (data) setScenario(data);
        });
    }
  }, [scenarioId]);

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    console.log(isUser ? "User:" : "Agent:", text);
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
    console.error("Connection error:", error);
    toast({
      variant: "destructive",
      title: "Error de conexión",
      description: error,
    });
    setSessionState("idle");
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
    scenarioId,
    onTranscript: handleTranscript,
    onError: handleError,
  });

  // Keep track of session duration
  sessionDurationRef.current = sessionTime;

  // Transition to active when connected
  useEffect(() => {
    if (isConnected && sessionState === "connecting") {
      setSessionState("active");
      setConnectionStatus("Conectado");
    }
  }, [isConnected, sessionState]);

  // Update status during connection
  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus("Conectando con el agente...");
    }
  }, [isConnecting]);

  // Handle free tier time up
  const handleTimeUp = useCallback(() => {
    disconnect();
    setSessionState("timeup");
  }, [disconnect]);

  const handleStart = async () => {
    setSessionState("connecting");
    setConnectionStatus("Solicitando permisos de micrófono...");
    setTranscriptMessages([]); // Clear previous messages
    connect();
  };

  const handleEndCall = () => {
    disconnect();
    if (isFreeTier) {
      // For free tier, just go back to landing
      navigate("/");
    } else {
      setSessionState("feedback");
    }
  };

  const handleFeedbackSubmit = async (rating: number) => {
    await savePracticeSession(sessionDurationRef.current, rating, scenarioId ?? undefined);
    setSessionState("idle");
    navigate("/");
  };

  const handleBack = () => {
    if (isConnected) {
      disconnect();
    }
    navigate("/");
  };

  // Time up modal for free tier
  if (sessionState === "timeup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <TimeUpModal 
          open={true} 
          characterName={character?.name || "el asistente"} 
        />
      </div>
    );
  }

  if (sessionState === "feedback") {
    return (
      <FeedbackScreen
        agentName={character?.name || scenario?.voice_type === "male" ? "Cliente" : "María"}
        onSubmit={handleFeedbackSubmit}
        sessionDuration={sessionDurationRef.current}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
      {/* Back button */}
      <div className="absolute top-6 left-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      {/* User menu or free tier timer */}
      <div className="absolute top-6 right-6">
        {isFreeTier && sessionState === "active" ? (
          <FreeTierTimer
            maxSeconds={FREE_TIER_MAX_SECONDS}
            currentSeconds={sessionTime}
            onTimeUp={handleTimeUp}
          />
        ) : user ? (
          <UserMenu />
        ) : null}
      </div>

      {/* Connection status indicator */}
      {connectionStatus && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm text-muted-foreground">{connectionStatus}</span>
        </div>
      )}

      {/* Show character or scenario info when idle/connecting */}
      {(sessionState === "idle" || sessionState === "connecting") && (
        <div className="absolute top-20 left-6 max-w-xs">
          {character ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Hablando con {character.name}
              </p>
              <p className="text-xs text-muted-foreground">{character.persona}</p>
            </>
          ) : scenario ? (
            <>
              <p className="text-sm font-medium text-foreground">{scenario.name}</p>
              <p className="text-xs text-muted-foreground">Objeción: "{scenario.objection}"</p>
            </>
          ) : null}
        </div>
      )}

      {(sessionState === "idle" || sessionState === "connecting") && (
        <LogoMorph
          onClick={handleStart}
          isConnecting={isConnecting || sessionState === "connecting"}
          isMorphing={sessionState === "connecting"}
        />
      )}

      {sessionState === "active" && (
        <div className="flex w-full max-w-4xl mx-auto px-6 gap-8">
          {/* Left side - Voice interaction */}
          <div className="flex-1 flex flex-col items-center gap-8 animate-fade-in">
            {character ? (
              <p className="text-sm text-muted-foreground">
                Hablando con {character.name} ({character.role === "coach" ? "Coach" : "Cliente"})
              </p>
            ) : scenario ? (
              <p className="text-sm text-muted-foreground">
                Practicando: "{scenario.objection}"
              </p>
            ) : null}
            
            {!isFreeTier && <PracticeTimer totalSeconds={sessionTime} />}
            
            <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} />

            <VoiceControls
              isMuted={isMuted}
              onMuteToggle={toggleMute}
              onEndCall={handleEndCall}
            />
          </div>

          {/* Right side - Live transcript */}
          {showTranscript && (
            <div className="w-80 h-[400px] bg-card border border-border rounded-xl flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Transcripción</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowTranscript(false)}
                >
                  ×
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LiveTranscript messages={transcriptMessages} />
              </div>
            </div>
          )}

          {/* Toggle transcript button when hidden */}
          {!showTranscript && (
            <Button
              variant="outline"
              size="sm"
              className="absolute bottom-6 right-6"
              onClick={() => setShowTranscript(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Mostrar transcripción
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Practice;
