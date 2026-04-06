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
import MobileNavigation from "@/components/MobileNavigation";
import { TimeUpModal } from "@/components/practice/TimeUpModal";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallSounds } from "@/hooks/useCallSounds";
import { scenariosApi, sessionsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Wifi,
  WifiOff,
  MessageSquare,
  Sparkles,
  Swords,
  ShieldAlert,
  Zap,
  Handshake,
  GraduationCap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import AICompanionOrb from "@/components/AICompanionOrb";
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

// ============================================
// Agent Suggestions (Claude-style bubbles)
// ============================================

interface AgentSuggestion {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  agentSecretName?: string; // maps to ElevenLabs agent env var
  color: string;
}

const agentSuggestions: AgentSuggestion[] = [
  {
    id: "coach",
    label: "Coach",
    description: "Feedback y tips en tiempo real sobre tu tecnica de ventas",
    icon: Sparkles,
    agentSecretName: undefined, // uses default ELEVENLABS_AGENT_ID
    color: "from-primary/15 to-primary/5 border-primary/30 hover:border-primary/60",
  },
  {
    id: "roleplay",
    label: "Role-Play",
    description: "Practica una llamada completa con un cliente simulado",
    icon: Swords,
    agentSecretName: "ELEVENLABS_AGENT_ROLEPLAY",
    color: "from-secondary/15 to-secondary/5 border-secondary/30 hover:border-secondary/60",
  },
  {
    id: "objeciones",
    label: "Objeciones",
    description: "Entrena respuestas a las objeciones mas comunes de clientes",
    icon: ShieldAlert,
    agentSecretName: "ELEVENLABS_AGENT_OBJECIONES",
    color: "from-orange-500/15 to-orange-500/5 border-orange-500/30 hover:border-orange-500/60",
  },
  {
    id: "pitch",
    label: "Pitch Express",
    description: "Practica tu elevator pitch en 60 segundos",
    icon: Zap,
    agentSecretName: "ELEVENLABS_AGENT_PITCH",
    color: "from-yellow-500/15 to-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/60",
  },
  {
    id: "cierre",
    label: "Cierre",
    description: "Enfocate en tecnicas de cierre y compromiso",
    icon: Handshake,
    agentSecretName: "ELEVENLABS_AGENT_CIERRE",
    color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
  },
  {
    id: "examen",
    label: "Examen Final",
    description: "Evaluacion completa de todas tus habilidades",
    icon: GraduationCap,
    agentSecretName: "ELEVENLABS_AGENT_EXAMEN_FINAL",
    color: "from-rose-500/15 to-rose-500/5 border-rose-500/30 hover:border-rose-500/60",
  },
];

const FREE_TIER_MAX_SECONDS = 180;

const Practice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const scenarioId = searchParams.get("scenario");
  const agentParam = searchParams.get("agent");
  const tier = searchParams.get("tier");

  const isFreeTier = tier === "free" && !user;

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [orbWinking, setOrbWinking] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentEvaluation, setAgentEvaluation] = useState<EvaluationResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentSuggestion | null>(null);
  const sessionDurationRef = useRef<number>(0);

  const { savePracticeSession } = usePracticeSessions();
  const { playStartCall, playConnected, playEndCall } = useCallSounds();

  // Resolve which agent secret to use
  const activeAgentSecret = selectedAgent?.agentSecretName || agentParam || undefined;

  // Personalized greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.fullName?.split(" ")[0] || "";
    if (hour < 12) return name ? `Buenos dias, ${name}` : "Buenos dias";
    if (hour < 18) return name ? `Buenas tardes, ${name}` : "Buenas tardes";
    return name ? `Buenas noches, ${name}` : "Buenas noches";
  };

  // Fetch scenario details
  useEffect(() => {
    if (scenarioId) {
      scenariosApi
        .getById(scenarioId)
        .then((data) => {
          if (data) setScenario(data);
        })
        .catch((err) => console.error("Error fetching scenario:", err));
    }
  }, [scenarioId]);

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    setTranscriptMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, isUser, timestamp: new Date() },
    ]);
  }, []);

  const handleError = useCallback(
    (error: string) => {
      toast({ variant: "destructive", title: "Error de conexion", description: error });
      setSessionState("idle");
      setConnectionStatus("");
    },
    [toast]
  );

  const handleEvaluation = useCallback((evaluation: EvaluationResult) => {
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
    agentSecretName: activeAgentSecret,
    userId: user?.id || null,
    userName: user?.fullName || null,
    onTranscript: handleTranscript,
    onEvaluation: handleEvaluation,
    onError: handleError,
  });

  sessionDurationRef.current = sessionTime;

  useEffect(() => {
    if (isConnected && sessionState === "connecting") {
      setSessionState("active");
      setConnectionStatus("Conectado");
      playConnected();
    }
  }, [isConnected, sessionState, playConnected]);

  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus("Conectando con el agente...");
    }
  }, [isConnecting]);

  const handleTimeUp = useCallback(() => {
    disconnect();
    setSessionState("timeup");
  }, [disconnect]);

  const handleStart = async (agent?: AgentSuggestion) => {
    if (agent) setSelectedAgent(agent);
    setOrbWinking(true);

    setSessionState("connecting");
    setConnectionStatus("Solicitando permisos de microfono...");
    setTranscriptMessages([]);
    setAgentEvaluation(null);

    if (user && scenarioId) {
      const sessionId = await savePracticeSession(0, undefined, scenarioId);
      setCurrentSessionId(sessionId);
    } else {
      setCurrentSessionId(null);
    }

    playStartCall();
    connect();
  };

  const handleEndCall = async () => {
    playEndCall();
    disconnect();

    if (isFreeTier) {
      navigate("/");
      return;
    }

    if (user && scenarioId) {
      setSessionState("evaluating");
      if (currentSessionId) {
        await sessionsApi.update(currentSessionId, {
          durationSeconds: sessionDurationRef.current,
        });
      }
      setTimeout(() => {
        if (sessionState === "evaluating") {
          toast({
            variant: "destructive",
            title: "Evaluacion no recibida",
            description: "El agente no envio la evaluacion. Puedes intentar de nuevo.",
          });
          setSessionState("idle");
        }
      }, 15000);
    } else {
      setSessionState("idle");
      setSelectedAgent(null);
    }
  };

  const handleContinue = () => {
    setSessionState("idle");
    setAgentEvaluation(null);
    setSelectedAgent(null);
    navigate("/scenarios");
  };

  const handleRetry = () => {
    setSessionState("idle");
    setTranscriptMessages([]);
    setCurrentSessionId(null);
    setAgentEvaluation(null);
    handleStart(selectedAgent || undefined);
  };

  const handleBack = () => {
    if (isConnected) disconnect();
    if (sessionState === "idle" && selectedAgent) {
      setSelectedAgent(null);
      return;
    }
    navigate(user ? "/scenarios" : "/");
  };

  // Time up modal
  if (sessionState === "timeup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <TimeUpModal open={true} characterName={selectedAgent?.label || "el asistente"} />
      </div>
    );
  }

  // Evaluation screen
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
      {user && <LeftSidebar />}

      <div className={`flex-1 flex flex-col items-center justify-center relative ${user ? "lg:ml-60" : ""}`}>
        {/* Back button */}
        {(sessionState !== "idle" || selectedAgent || !user) && (
          <div className="absolute top-6 left-6 z-10">
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

        {/* User menu / Free tier timer */}
        <div className="absolute top-6 right-6 z-10">
          {isFreeTier && sessionState === "active" ? (
            <FreeTierTimer maxSeconds={FREE_TIER_MAX_SECONDS} currentSeconds={sessionTime} onTimeUp={handleTimeUp} />
          ) : user ? (
            <UserMenu />
          ) : null}
        </div>

        {/* Connection status */}
        {connectionStatus && sessionState === "connecting" && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-muted rounded-full z-10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold text-muted-foreground">{connectionStatus}</span>
          </div>
        )}

        {/* ===== IDLE STATE: Suggestion Bubbles (Claude-style) ===== */}
        {sessionState === "idle" && !selectedAgent && (
          <div className="flex flex-col items-center w-full max-w-2xl px-4 animate-fade-in">
            {/* AI Companion Orb */}
            <div className="mb-6">
              <AICompanionOrb
                size="md"
                listening
                winkOut={orbWinking}
                onWinkOutDone={() => setOrbWinking(false)}
              />
            </div>

            {/* Greeting */}
            <h1
              className="text-2xl sm:text-3xl font-bold text-foreground mb-2 text-center"
              style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
            >
              {getGreeting()}
            </h1>
            <p className="text-muted-foreground mb-8 text-center text-sm sm:text-base">
              Elige como quieres practicar hoy
            </p>

            {/* Suggestion bubbles grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
              {agentSuggestions.map((agent) => {
                const Icon = agent.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleStart(agent)}
                    className={`group flex items-start gap-3 p-4 rounded-2xl border-2 bg-gradient-to-br text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${agent.color}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground">{agent.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick scenario access */}
            {user && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/prospecting")}
                  className="rounded-xl text-xs font-semibold"
                >
                  Escenarios de Prospeccion
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/scenarios")}
                  className="rounded-xl text-xs font-semibold"
                >
                  Escenarios de Llamada
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ===== CONNECTING STATE: Logo morph ===== */}
        {(sessionState === "connecting" || (sessionState === "idle" && selectedAgent)) && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            {selectedAgent && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/60 rounded-full mb-2">
                <selectedAgent.icon className="w-4 h-4 text-foreground/70" />
                <span className="text-sm font-bold text-foreground">{selectedAgent.label}</span>
              </div>
            )}
            <LogoMorph
              onClick={() => handleStart(selectedAgent || undefined)}
              isConnecting={isConnecting || sessionState === "connecting"}
              isMorphing={sessionState === "connecting"}
            />
          </div>
        )}

        {/* ===== ACTIVE SESSION ===== */}
        {sessionState === "active" && (
          <div className="flex flex-col items-center justify-center w-full h-full px-4 pb-4 animate-fade-in">
            <div className="flex flex-col items-center gap-3 sm:gap-6">
              {/* Agent label */}
              <div className="flex items-center gap-2">
                {selectedAgent && <selectedAgent.icon className="w-4 h-4 text-muted-foreground" />}
                <p
                  className="text-xs sm:text-base font-bold text-muted-foreground text-center"
                  style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                >
                  {selectedAgent
                    ? `Hablando con ${selectedAgent.label}`
                    : scenario
                      ? `Practicando: "${scenario.objection}"`
                      : "En sesion"}
                </p>
              </div>

              {!isFreeTier && <PracticeTimer totalSeconds={sessionTime} />}

              <AICompanionOrb speaking={isSpeaking} listening={!isMuted} size={isMobile ? "sm" : "lg"} energy />

              <VoiceControls isMuted={isMuted} onMuteToggle={toggleMute} onEndCall={handleEndCall} />
            </div>

          </div>
        )}
      </div>

      {user && <MobileNavigation />}
    </div>
  );
};

export default Practice;
