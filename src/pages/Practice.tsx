import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LogoMorph from "@/components/LogoMorph";
import EvaluationScreen from "@/components/practice/EvaluationScreen";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import LiveTranscript from "@/components/LiveTranscript";
import MobileTranscriptSheet from "@/components/practice/MobileTranscriptSheet";
import { FreeTierTimer } from "@/components/practice/FreeTierTimer";
import { TimeUpModal } from "@/components/practice/TimeUpModal";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { useScribeRealtime } from "@/hooks/useScribeRealtime";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { scenariosApi, sessionsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wifi, WifiOff, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import type { Scenario } from "@/hooks/useScenarios";

type SessionState = "idle" | "connecting" | "active" | "evaluating" | "evaluated" | "timeup";

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

// Character configuration - Only Álvaro as coach
const characters: Record<string, { name: string; role: string; persona: string }> = {
  alvaro: {
    name: "Álvaro",
    role: "coach",
    persona: "Tu coach personal de ventas que te da feedback en tiempo real y consejos para mejorar.",
  },
};

const FREE_TIER_MAX_SECONDS = 180; // 3 minutes

const Practice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentEvaluation, setAgentEvaluation] = useState<EvaluationResult | null>(null);
  const sessionDurationRef = useRef<number>(0);
  
  const { savePracticeSession } = usePracticeSessions();

  // Scribe Realtime for live user transcription
  const {
    isConnected: isScribeConnected,
    partialTranscript,
    connect: connectScribe,
    disconnect: disconnectScribe,
    clearTranscripts,
  } = useScribeRealtime({
    onCommittedTranscript: (text) => {
      // Add user's committed transcript to messages
      setTranscriptMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}-${Math.random()}`,
          text,
          isUser: true,
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Fetch scenario details
  useEffect(() => {
    if (scenarioId) {
      scenariosApi.getById(scenarioId)
        .then((data) => {
          if (data) setScenario(data);
        })
        .catch((err) => console.error("Error fetching scenario:", err));
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

  const handleEvaluation = useCallback((evaluation: EvaluationResult) => {
    console.log("Received evaluation from agent:", evaluation);
    setAgentEvaluation(evaluation);
    setSessionState("evaluated");
  }, []);

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
    sessionId: currentSessionId,
    onTranscript: handleTranscript,
    onEvaluation: handleEvaluation,
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
    disconnectScribe();
    setSessionState("timeup");
  }, [disconnect, disconnectScribe]);

  const handleStart = async () => {
    setSessionState("connecting");
    setConnectionStatus("Solicitando permisos de micrófono...");
    setTranscriptMessages([]); // Clear previous messages
    setAgentEvaluation(null);
    clearTranscripts();
    
    // Save the session first to get a session ID for evaluation
    if (user && scenarioId) {
      const sessionId = await savePracticeSession(0, undefined, scenarioId);
      setCurrentSessionId(sessionId);
    } else {
      setCurrentSessionId(null);
    }
    
    connect();
    // Also start Scribe for real-time user transcription
    connectScribe();
  };

  const handleEndCall = async () => {
    disconnect();
    disconnectScribe();
    
    if (isFreeTier) {
      // For free tier, just go back to landing
      navigate("/");
      return;
    }
    
    // For authenticated users, wait for agent evaluation
    if (user && scenarioId) {
      setSessionState("evaluating");
      
      // Update session duration
      if (currentSessionId) {
        await sessionsApi.update(currentSessionId, {
          durationSeconds: sessionDurationRef.current,
        });
      }
      
      // Set a timeout - if agent doesn't send evaluation, show message
      setTimeout(() => {
        if (sessionState === "evaluating") {
          toast({
            variant: "destructive",
            title: "Evaluación no recibida",
            description: "El agente no envió la evaluación. Puedes intentar de nuevo.",
          });
          setSessionState("idle");
        }
      }, 15000); // 15 second timeout
    } else {
      // No scenario selected, just go back
      navigate("/scenarios");
    }
  };

  const handleContinue = () => {
    setSessionState("idle");
    setAgentEvaluation(null);
    navigate("/scenarios");
  };

  const handleRetry = () => {
    setSessionState("idle");
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setAgentEvaluation(null);
    // Start a new session
    handleStart();
  };

  const handleBack = () => {
    if (isConnected) {
      disconnect();
      disconnectScribe();
    }
    // Navigate based on auth status: logged in users go to scenarios, others to landing
    navigate(user ? "/scenarios" : "/");
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

  // Evaluation screen (waiting for agent evaluation or showing results)
  if (sessionState === "evaluating" || sessionState === "evaluated") {
    return (
      <EvaluationScreen
        isEvaluating={sessionState === "evaluating"}
        evaluation={agentEvaluation}
        scenarioName={scenario?.name}
        sessionDuration={sessionDurationRef.current}
        onContinue={handleContinue}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar - Only show for authenticated users */}
      {user && <LeftSidebar />}

      {/* Main content */}
      <div className={`flex-1 flex flex-col items-center justify-center relative ${user ? 'lg:ml-56' : ''}`}>
        {/* Back button - only for non-authenticated users */}
        {!user && (
          <div className="absolute top-6 left-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="font-bold uppercase tracking-wider text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        )}

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
          <span className="text-sm font-semibold text-muted-foreground">{connectionStatus}</span>
        </div>
      )}

      {/* Show character or scenario info when idle/connecting */}
      {(sessionState === "idle" || sessionState === "connecting") && (
        <div className="absolute top-20 left-6 max-w-xs">
          {character ? (
            <>
              <p 
                className="text-base font-extrabold text-foreground"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Hablando con {character.name}
              </p>
              <p className="text-sm font-medium text-muted-foreground">{character.persona}</p>
            </>
          ) : scenario ? (
            <>
              <p 
                className="text-base font-extrabold text-foreground"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                {scenario.name}
              </p>
              <p className="text-sm font-medium text-muted-foreground">Objeción: "{scenario.objection}"</p>
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
        <div className="flex flex-col items-center justify-center w-full h-full px-4 pb-4 animate-fade-in">
          {/* Voice interaction - centered */}
          <div className="flex flex-col items-center gap-3 sm:gap-6">
            {character ? (
              <p 
                className="text-xs sm:text-base font-bold text-muted-foreground text-center px-4"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Hablando con {character.name} ({character.role === "coach" ? "Coach" : "Cliente"})
              </p>
            ) : scenario ? (
              <p 
                className="text-xs sm:text-base font-bold text-muted-foreground text-center px-4"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Practicando: "{scenario.objection}"
              </p>
            ) : null}
            
            {!isFreeTier && <PracticeTimer totalSeconds={sessionTime} />}
            
            <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} size={isMobile ? "sm" : "lg"} />

            {/* Partial transcript indicator on mobile */}
            {isMobile && partialTranscript && (
              <div className="max-w-[280px] bg-muted/50 rounded-xl px-3 py-2 animate-pulse">
                <p className="text-xs text-muted-foreground italic truncate">
                  {partialTranscript}
                </p>
              </div>
            )}

            <VoiceControls
              isMuted={isMuted}
              onMuteToggle={toggleMute}
              onEndCall={handleEndCall}
            />
          </div>

          {/* Desktop: Side transcript panel */}
          {!isMobile && showTranscript && (
            <div className="hidden sm:flex w-80 h-[400px] bg-card border-2 border-border rounded-2xl flex-col shadow-[0_4px_0_0_hsl(var(--border))] absolute right-6 top-1/2 -translate-y-1/2">
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
                  messages={partialTranscript ? [
                    ...transcriptMessages,
                    { id: "partial", text: partialTranscript + "...", isUser: true, timestamp: new Date() }
                  ] : transcriptMessages} 
                />
              </div>
            </div>
          )}

          {/* Desktop: Toggle transcript button */}
          {!isMobile && !showTranscript && (
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

          {/* Mobile: Sheet-based transcript */}
          {isMobile && (
            <MobileTranscriptSheet 
              messages={transcriptMessages} 
              partialTranscript={partialTranscript}
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default Practice;
