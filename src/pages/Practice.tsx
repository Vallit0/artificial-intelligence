import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import VoiceControls from "@/components/VoiceControls";
import logoSenoriales from "@/assets/logo-senoriales.png";
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
  UserCheck,
  MapPin,
  BookOpen,
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
  agentSecretName?: string;
  color: string;
  orbGradient: string;
  redirectTo?: string;
}

const agentSuggestions: AgentSuggestion[] = [
  {
    id: "coach",
    label: "Coach",
    description: "Feedback y tips en tiempo real sobre tu técnica de ventas",
    icon: Sparkles,
    agentSecretName: "ELEVENLABS_AGENT_COACH",
    color: "from-primary/15 to-primary/5 border-primary/30 hover:border-primary/60",
    orbGradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #c084fc 70%, #7c3aed 100%)",
  },
  {
    id: "roleplay-cliente",
    label: "Role-Play Cliente",
    description: "Simula ser el cliente y practica cómo responder a un asesor",
    icon: Swords,
    agentSecretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE",
    color: "from-secondary/15 to-secondary/5 border-secondary/30 hover:border-secondary/60",
    orbGradient: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 40%, #67e8f9 70%, #06b6d4 100%)",
  },
  {
    id: "roleplay-asesor",
    label: "Role-Play Asesor",
    description: "Practica tu rol como cliente con un asesor simulado",
    icon: UserCheck,
    agentSecretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR",
    color: "from-orange-500/15 to-orange-500/5 border-orange-500/30 hover:border-orange-500/60",
    orbGradient: "linear-gradient(135deg, #ea580c 0%, #f97316 40%, #fb923c 70%, #ea580c 100%)",
  },
  {
    id: "prospeccion-fisica",
    label: "Prospección Física",
    description: "Entrena técnicas de prospección presencial y en campo",
    icon: MapPin,
    color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
    orbGradient: "linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 70%, #059669 100%)",
    redirectTo: "/prospecting",
  },
  {
    id: "legado-vida",
    label: "Legado de Vida",
    description: "Practica cómo presentar y entregar el Legado de Vida",
    icon: BookOpen,
    color: "from-yellow-500/15 to-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/60",
    orbGradient: "linear-gradient(135deg, #ca8a04 0%, #eab308 40%, #facc15 70%, #ca8a04 100%)",
    redirectTo: "/legado",
  },
  {
    id: "examen",
    label: "Examen Final",
    description: "Evaluación completa de todas tus habilidades",
    icon: GraduationCap,
    color: "from-rose-500/15 to-rose-500/5 border-rose-500/30 hover:border-rose-500/60",
    orbGradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 40%, #fb7185 70%, #e11d48 100%)",
    redirectTo: "/quests",
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
  const [orbGrowing, setOrbGrowing] = useState(false);
  const [orbGradient, setOrbGradient] = useState<string | undefined>(undefined);
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

  const [greetingIndex, setGreetingIndex] = useState(0);
  const [greetingVisible, setGreetingVisible] = useState(true);
  const [pokeBubble, setPokeBubble] = useState<string | null>(null);
  const pokeBubbleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve which agent secret to use
  const activeAgentSecret = selectedAgent?.agentSecretName || agentParam || undefined;

  const pokeMessages = [
    "¡Oye!",
    "¡No me toques!",
    "¡Ya basta!",
    "¡Estoy trabajando!",
    "¡Déjame en paz!",
    "¡Auch!",
    "¡Para ya!",
    "¡Qué molesto!",
  ];

  const handleOrbPoke = () => {
    if (pokeBubbleTimeout.current) clearTimeout(pokeBubbleTimeout.current);
    const msg = pokeMessages[Math.floor(Math.random() * pokeMessages.length)];
    setPokeBubble(msg);
    pokeBubbleTimeout.current = setTimeout(() => setPokeBubble(null), 1800);
  };

  // Personalized greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.fullName?.split(" ")[0] || "";
    if (hour < 12) return name ? `Buenos días, ${name}` : "Buenos días";
    if (hour < 18) return name ? `Buenas tardes, ${name}` : "Buenas tardes";
    return name ? `Buenas noches, ${name}` : "Buenas noches";
  };

  const greetingTexts = [
    { title: getGreeting(), subtitle: "Elige cómo quieres practicar hoy" },
    { title: "¿Qué deseas practicar hoy?", subtitle: "Selecciona un modo para empezar" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingVisible(false);
      setTimeout(() => {
        setGreetingIndex((prev) => (prev + 1) % 2);
        setGreetingVisible(true);
      }, 600);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

    // Step 1: change orb color and grow
    if (agent) setOrbGradient(agent.orbGradient);
    setOrbGrowing(true);

    // Step 2: wink after it grows
    setTimeout(() => setOrbWinking(true), 400);

    // Step 3: after wink completes, transition to connecting
    setTimeout(async () => {
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
      setOrbGrowing(false);
      setOrbWinking(false);
    }, 1200);
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
      setOrbGradient(undefined);
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
            <div className="relative mb-4">
              {/* Poke speech bubble */}
              {pokeBubble && (
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-white dark:bg-zinc-800 text-foreground text-xs font-bold rounded-xl shadow-lg whitespace-nowrap animate-fade-in"
                  style={{
                    animation: "pokeBubbleIn 0.2s ease-out",
                  }}
                >
                  {pokeBubble}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-800 rotate-45 shadow-sm" />
                </div>
              )}
              <div
                className="transition-transform duration-500 ease-out"
                style={{ transform: orbGrowing ? "scale(1.6)" : "scale(1)" }}
              >
                <AICompanionOrb
                  size="md"
                  listening
                  winkOut={orbWinking}
                  onWinkOutDone={() => {}}
                  gradient={orbGradient}
                  interactive
                  onPoke={handleOrbPoke}
                />
              </div>
            </div>
            <img
              src={logoSenoriales}
              alt="Centro de Negocios Señoriales"
              className="h-10 w-auto mb-4 opacity-80"
            />

            {/* Greeting */}
            <div
              className="text-center mb-8 h-16 flex flex-col justify-center transition-all duration-500 ease-in-out"
              style={{
                opacity: greetingVisible ? 1 : 0,
                transform: greetingVisible ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground mb-1"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                {greetingTexts[greetingIndex].title}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {greetingTexts[greetingIndex].subtitle}
              </p>
            </div>

            {/* Suggestion bubbles grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
              {agentSuggestions.map((agent) => {
                const Icon = agent.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => agent.redirectTo ? navigate(agent.redirectTo) : handleStart(agent)}
                    className={`group flex items-start gap-3 p-4 rounded-2xl border-2 bg-gradient-to-br text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] shadow-md ${agent.color}`}
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

        {/* ===== CONNECTING STATE: Orb ===== */}
        {(sessionState === "connecting" || (sessionState === "idle" && selectedAgent)) && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            {selectedAgent && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/60 rounded-full mb-2">
                <selectedAgent.icon className="w-4 h-4 text-foreground/70" />
                <span className="text-sm font-bold text-foreground">{selectedAgent.label}</span>
              </div>
            )}
            <button onClick={() => handleStart(selectedAgent || undefined)}>
              <AICompanionOrb
                size="lg"
                energy
                speaking={false}
                listening={isConnecting}
                gradient={selectedAgent?.orbGradient}
              />
            </button>
            {sessionState === "connecting" && (
              <p className="text-sm text-muted-foreground">Preparando sesión...</p>
            )}
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

              <AICompanionOrb speaking={isSpeaking} listening={!isMuted} size={isMobile ? "sm" : "lg"} energy gradient={selectedAgent?.orbGradient} />

              <VoiceControls isMuted={isMuted} onMuteToggle={toggleMute} onEndCall={handleEndCall} />
            </div>

          </div>
        )}
      </div>

      {user && <MobileNavigation />}

      <style>{`
        @keyframes pokeBubbleIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.8); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default Practice;
