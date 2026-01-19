import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LogoMorph from "@/components/LogoMorph";
import FeedbackScreen from "@/components/FeedbackScreen";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Scenario } from "@/hooks/useScenarios";

type SessionState = "idle" | "connecting" | "active" | "feedback";

const Practice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
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

  const handleStart = async () => {
    setSessionState("connecting");
    setConnectionStatus("Solicitando permisos de micrófono...");
    connect();
  };

  const handleEndCall = () => {
    disconnect();
    setSessionState("feedback");
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

  if (sessionState === "feedback") {
    return (
      <FeedbackScreen
        agentName={scenario?.voice_type === "male" ? "Cliente" : "María"}
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

      {/* User menu */}
      <div className="absolute top-6 right-6">
        <UserMenu />
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

      {/* Show scenario info when idle/connecting */}
      {(sessionState === "idle" || sessionState === "connecting") && scenario && (
        <div className="absolute top-20 left-6 max-w-xs">
          <p className="text-sm font-medium text-foreground">{scenario.name}</p>
          <p className="text-xs text-muted-foreground">Objeción: "{scenario.objection}"</p>
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
        <div className="flex flex-col items-center gap-12 animate-fade-in">
          {scenario && (
            <p className="text-sm text-muted-foreground">
              Practicando: "{scenario.objection}"
            </p>
          )}
          <PracticeTimer totalSeconds={sessionTime} />
          
          <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} />

          <VoiceControls
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            onEndCall={handleEndCall}
          />
        </div>
      )}
    </div>
  );
};

export default Practice;
