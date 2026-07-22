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
import { usePracticeSessions, type PracticeMode } from "@/hooks/usePracticeSessions";
import { useAuth } from "@/hooks/useAuth";
import { useLevelMode, useDidLevelJustChange } from "@/hooks/useLevelMode";
import { usePlatformConfig } from "@/hooks/useAppConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallSounds } from "@/hooks/useCallSounds";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";
import { api } from "@/lib/api-client";
import { DEMO } from "@/lib/demoMode";
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
  GraduationCap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import AICompanionOrb from "@/components/AICompanionOrb";
import type { Scenario } from "@/hooks/useScenarios";
import { prospectingScenarios } from "@/components/prospecting/ProspectingCarousel";

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
  checklist?: { label: string; passed: boolean }[];
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

const practiceAgentSuggestions: AgentSuggestion[] = [
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
    description: "Álvaro es un Cliente",
    icon: Swords,
    agentSecretName: "ELEVENLABS_AGENT_ROLEPLAY_CLIENTE",
    color: "from-secondary/15 to-secondary/5 border-secondary/30 hover:border-secondary/60",
    orbGradient: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 40%, #67e8f9 70%, #06b6d4 100%)",
  },
  {
    id: "roleplay-asesor",
    label: "Role-Play Asesor",
    description: "Álvaro es un Asesor",
    icon: UserCheck,
    agentSecretName: "ELEVENLABS_AGENT_ROLEPLAY_ASESOR",
    color: "from-orange-500/15 to-orange-500/5 border-orange-500/30 hover:border-orange-500/60",
    orbGradient: "linear-gradient(135deg, #ea580c 0%, #f97316 40%, #fb923c 70%, #ea580c 100%)",
  },
  {
    id: "prospeccion-fisica",
    label: "Escenarios de Prospección",
    description: "Entrena técnicas de prospección presencial y en campo",
    icon: MapPin,
    color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
    orbGradient: "linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 70%, #059669 100%)",
    redirectTo: "/prospecting",
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

const LEVEL2_HIDDEN_IDS = new Set(["prospeccion-fisica"]);
const LEVEL2_ORB_GRADIENT =
  "linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #c084fc 70%, #7c3aed 100%)";

const objectionsAgentSuggestions: AgentSuggestion[] = practiceAgentSuggestions
  // Nivel 2 oculta el atajo a Prospección. Conserva los modos de práctica de
  // llamada (Coach, Roleplay) y los enruta a agentes ElevenLabs distintos vía
  // secret name (sufijo _NIVEL2). El Examen Final se conserva pero apunta a su
  // propia página de objeciones (no a la compuerta del Nivel 1). También
  // sustituye el persona "Álvaro" por "Alvaro" en las descripciones y unifica
  // el orbe a un tono morado para diferenciar visualmente el nivel.
  .filter((agent) => !LEVEL2_HIDDEN_IDS.has(agent.id))
  .map((agent) => {
    const next: AgentSuggestion = {
      ...agent,
      description: agent.description.replace(/Álvaro/g, "Alvaro"),
      orbGradient: LEVEL2_ORB_GRADIENT,
    };
    if (agent.agentSecretName) {
      next.agentSecretName = `${agent.agentSecretName}_NIVEL2`;
    }
    // El Examen Final del Nivel 2 evalúa el manejo de objeciones y entrega el
    // certificado de finalización del programa, así que apunta a su propia ruta.
    if (agent.id === "examen") {
      next.redirectTo = "/examen-objeciones";
      next.description = "Evaluación de manejo de objeciones y certificado final";
    }
    return next;
  });

// Tope de duración por módulo. Toda llamada se cierra automáticamente al
// alcanzarlo: Prospección 5 min, Objeciones 10 min.
const PROSPECCION_MAX_SECONDS = 5 * 60;
const OBJECIONES_MAX_SECONDS = 10 * 60;

const Practice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { currentLevel } = useLevelMode();
  const animateLevelChange = useDidLevelJustChange();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const isLevel2 = currentLevel === 2;
  const agentSuggestions = isLevel2 ? objectionsAgentSuggestions : practiceAgentSuggestions;
  // Tope de duración configurable por el admin (AppConfig); cae a los defaults
  // históricos mientras la config carga.
  const { config: platformConfig } = usePlatformConfig();
  const callMaxSeconds = isLevel2
    ? platformConfig?.callDurationObjecionesSec ?? OBJECIONES_MAX_SECONDS
    : platformConfig?.callDurationProspeccionSec ?? PROSPECCION_MAX_SECONDS;

  const scenarioId = searchParams.get("scenario");
  const agentParam = searchParams.get("agent");
  const prospectingParam = searchParams.get("prospecting");
  const tier = searchParams.get("tier");

  const isFreeTier = tier === "free" && !user;
  // Demo del video: /practice?demo=1&call=1 fuerza el estado de llamada ACTIVA
  // (UI real) sin conectar a ElevenLabs.
  const demoCall = DEMO && searchParams.get("call") === "1";

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
  const [demoSpeaking, setDemoSpeaking] = useState(true);
  const [demoSecs, setDemoSecs] = useState(0);
  const sessionDurationRef = useRef<number>(0);

  const { savePracticeSession, evaluateSession } = usePracticeSessions();
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
    const name = user?.firstName || "";
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

  // Demo del video: entra directo a la llamada activa (sin conectar).
  useEffect(() => {
    if (!demoCall) return;
    const persona = searchParams.get("persona");
    const base = practiceAgentSuggestions[1]; // Role-Play Cliente
    setSelectedAgent(persona ? { ...base, label: persona } : base);
    setSessionState("active");
    const s = setInterval(() => setDemoSpeaking((v) => !v), 1500);
    const t = setInterval(() => setDemoSecs((v) => v + 1), 1000);
    return () => {
      clearInterval(s);
      clearInterval(t);
    };
  }, [demoCall]);

  // Fetch scenario details
  useEffect(() => {
    if (scenarioId) {
      api
        .get<Scenario>(`/api/scenarios/${scenarioId}`)
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

  const handleEndCallRef = useRef<() => void>(() => {});
  const sessionStateRef = useRef<SessionState>("idle");
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const handleAgentDisconnected = useCallback((reason?: string) => {
    console.log("[TRACE] Agent ended the call, reason:", reason);
    handleEndCallRef.current();
  }, []);

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    sessionTime,
    variantId,
    getLatencyReport,
    connect,
    disconnect,
    toggleMute,
  } = useElevenLabsConversation({
    scenarioId,
    sessionId: currentSessionId,
    agentSecretName: activeAgentSecret,
    userId: user?.id || null,
    userName: user?.firstName || null,
    onTranscript: handleTranscript,
    onEvaluation: handleEvaluation,
    onError: handleError,
    onAgentDisconnected: handleAgentDisconnected,
  });

  sessionDurationRef.current = sessionTime;

  // Indicador de red en vivo (estilo "Internet bajo" de WhatsApp). Solo sondea
  // mientras la llamada está activa.
  const { quality: connectionQuality } = useConnectionQuality({
    active: sessionState === "active",
  });

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
    if (isFreeTier) {
      // Demo anónimo: cuelga y muestra el CTA de registro.
      disconnect();
      setSessionState("timeup");
      return;
    }
    // Alumno autenticado: cierra la llamada como un fin normal (con evaluación
    // si aplica) e informa que se alcanzó el tope de tiempo del módulo.
    toast({
      title: "Tiempo agotado",
      description: `La llamada se cerró automáticamente al alcanzar el máximo de ${Math.round(callMaxSeconds / 60)} minutos.`,
    });
    handleEndCallRef.current();
  }, [isFreeTier, disconnect, callMaxSeconds, toast]);

  // Deriva el modo de práctica que se persiste en la sesión para el desglose de
  // tiempo en analítica. Prospección es sub-modo de Cliente; cualquier práctica
  // en Nivel 2 cuenta como Role-Play Objeciones. Si no se reconoce el agente, se
  // deja sin clasificar (null) en vez de inventar un modo.
  const derivePracticeMode = (agent?: AgentSuggestion): PracticeMode | undefined => {
    if (prospectingParam || agent?.id.startsWith("prospecting-")) return "cliente_prospeccion";
    if (isLevel2) return "objeciones";
    switch (agent?.id) {
      case "roleplay-cliente":
        return "cliente";
      case "roleplay-asesor":
        return "asesor";
      case "coach":
        return "coach";
      default:
        return undefined;
    }
  };

  const handleStart = async (agent?: AgentSuggestion) => {
    console.log("[TRACE] handleStart called, agent:", agent?.id, agent?.agentSecretName);
    if (agent) setSelectedAgent(agent);

    // Step 1: change orb color and grow. La animación del orb (crecer + guiño)
    // es puramente estética y ahora corre EN PARALELO: ya no bloquea la conexión.
    if (agent) setOrbGradient(agent.orbGradient);
    setOrbGrowing(true);
    setTimeout(() => setOrbWinking(true), 400);
    setTimeout(() => {
      setOrbGrowing(false);
      setOrbWinking(false);
    }, 1200);

    // Step 2: conectar de inmediato. Antes esto vivía dentro de un setTimeout de
    // 1200ms (esperaba a que terminara la animación) y encima AWAITaba
    // savePracticeSession, así que el usuario perdía ~1.5s antes de que el SDK
    // siquiera empezara a conectar con ElevenLabs.
    console.log("[TRACE] calling connect() immediately (sin delay de animación)");
    setSessionState("connecting");
    setConnectionStatus("Solicitando permisos de microfono...");
    setTranscriptMessages([]);
    setAgentEvaluation(null);

    // La fila de sesión se persiste en segundo plano: el sessionId sólo se
    // necesita al EVALUAR (fin de la llamada), no para conectar. Tenerlo en
    // await bloqueaba el connect() un round-trip completo sin razón.
    if (user) {
      const practiceMode = derivePracticeMode(agent);
      savePracticeSession(
        0,
        undefined,
        scenarioId || undefined,
        variantId || undefined,
        undefined,
        practiceMode,
      )
        .then((sessionId) => setCurrentSessionId(sessionId))
        .catch((err) => console.error("[TRACE] savePracticeSession falló:", err));
    } else {
      setCurrentSessionId(null);
    }

    playStartCall();
    // Pasamos el agentSecretName FRESCO del clic: setSelectedAgent(agent) aún no
    // propagó a activeAgentSecret ni al ref del hook en este mismo tick, así que
    // sin esto connect() resolvería al agente DEFAULT (Coach). scenarioId viene
    // de la URL (estable), se deja al ref.
    const freshAgentSecret = agent?.agentSecretName ?? activeAgentSecret ?? null;
    console.log("[TRACE] About to call connect() con agente:", freshAgentSecret);
    connect({ agentSecretName: freshAgentSecret });
    console.log("[TRACE] connect() called");
  };

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!prospectingParam || !agentParam) return;
    if (sessionState !== "idle") return;
    const scenario = prospectingScenarios.find(
      (s) => s.id === parseInt(prospectingParam, 10)
    );
    autoStartedRef.current = true;
    const prospectingAgent: AgentSuggestion = {
      id: `prospecting-${prospectingParam}`,
      label: scenario?.title || "Prospección",
      description: scenario?.description || "",
      icon: MapPin,
      agentSecretName: agentParam,
      color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
      orbGradient:
        "linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 70%, #059669 100%)",
    };
    handleStart(prospectingAgent);
  }, [prospectingParam, agentParam, sessionState]);

  const handleEndCall = async () => {
    playEndCall();
    disconnect();

    if (isFreeTier) {
      navigate("/");
      return;
    }

    if (user && currentSessionId) {
      try {
        const latency = getLatencyReport();
        await api.patch(`/api/sessions/${currentSessionId}`, {
          durationSeconds: sessionDurationRef.current,
          connectMs: latency.connectMs,
          ttfaSamplesMs: latency.ttfaSamplesMs,
        });
      } catch (err) {
        console.error('Failed to update session duration:', err);
      }

      // Save transcript for replay
      if (transcriptMessages.length > 0) {
        api.post(`/api/sessions/${currentSessionId}/transcript`, {
          transcript: transcriptMessages.map(m => ({
            role: m.isUser ? 'user' : 'agent',
            content: m.text,
            timestamp: m.timestamp.getTime(),
          })),
        }).catch(err => console.error('Failed to save transcript:', err));
      }
    }

    if (user && scenarioId) {
      setSessionState("evaluating");
      // Wait briefly for the agent's submit_evaluation tool call. If it doesn't
      // arrive (agent not configured with the tool, or it crashed), fall back
      // to scoring the transcript server-side via OpenAI so the student is
      // never stuck on the evaluating screen and progression keeps working.
      const sessionIdForEval = currentSessionId;
      const transcriptForEval = transcriptMessages.map((m) => ({
        role: m.isUser ? "user" : "agent",
        content: m.text,
        timestamp: m.timestamp.getTime(),
      }));
      const durationForEval = sessionDurationRef.current;
      setTimeout(async () => {
        // If the agent already emitted submit_evaluation in the meantime,
        // sessionState will be "evaluated" — don't double-score.
        if (sessionStateRef.current !== "evaluating" || !sessionIdForEval) return;
        const result = await evaluateSession(
          sessionIdForEval,
          transcriptForEval,
          scenarioId,
          durationForEval,
        );
        if (sessionStateRef.current !== "evaluating") return;
        if (result) {
          setAgentEvaluation(result);
          setSessionState("evaluated");
        } else {
          toast({
            variant: "destructive",
            title: "No se pudo evaluar",
            description: "Hubo un problema al calcular tu puntaje. Intentá de nuevo.",
          });
          setSessionState("idle");
        }
      }, 8000);
    } else {
      setSessionState("idle");
      setSelectedAgent(null);
    }
  };

  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  });

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
          {sessionState === "active" ? (
            <FreeTierTimer
              maxSeconds={callMaxSeconds}
              currentSeconds={sessionTime}
              onTimeUp={handleTimeUp}
              showUpgrade={isFreeTier}
            />
          ) : user ? (
            <span data-tour="user-menu" className="inline-block">
              <UserMenu />
            </span>
          ) : null}
        </div>

        {/* Connection status */}
        {connectionStatus && sessionState === "connecting" && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-muted rounded-full z-10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold text-muted-foreground">{connectionStatus}</span>
          </div>
        )}

        {/* Indicador de red en vivo durante la llamada (estilo WhatsApp). Solo
            aparece cuando la conexión se degrada; en verde no molesta. */}
        {sessionState === "active" && connectionQuality !== "good" && (
          <div
            className={`absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full z-10 shadow-md animate-fade-in max-w-[92vw] text-center ${
              connectionQuality === "offline"
                ? "bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
            }`}
            role="status"
            aria-live="polite"
          >
            {connectionQuality === "offline" ? (
              <WifiOff className="h-4 w-4 shrink-0" />
            ) : (
              <Wifi className="h-4 w-4 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">
              {connectionQuality === "offline"
                ? "Sin conexión a internet"
                : "Internet bajo · la voz puede entrecortarse"}
            </span>
          </div>
        )}

        {/* ===== IDLE STATE: Suggestion Bubbles (Claude-style) ===== */}
        {sessionState === "idle" && !selectedAgent && (
          <div data-tour="practice-main" className="flex flex-col items-center w-full max-w-2xl px-4 pb-24 lg:pb-0 animate-fade-in">
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
                  gradient={isLevel2 ? LEVEL2_ORB_GRADIENT : orbGradient}
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

            {/* Module / Level badge */}
            <div className="mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] border ${
                  isLevel2
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30"
                    : "bg-primary/10 text-primary border-primary/30"
                }`}
              >
                {isLevel2 ? "Módulo · Manejo de Objeciones" : "Módulo · Prospección"}
              </span>
            </div>

            {/* Greeting */}
            <div
              className="text-center mb-8 min-h-16 flex flex-col justify-center transition-all duration-500 ease-in-out"
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
            <div
              key={`agent-grid-${currentLevel}`}
              data-tour="practice-modes"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8"
            >
              {agentSuggestions.map((agent, i) => {
                const Icon = agent.icon;
                // Si es la última tarjeta y queda sola en su fila (lista impar),
                // la centramos ocupando ambas columnas pero limitando su ancho.
                const isLoneLast =
                  i === agentSuggestions.length - 1 && agentSuggestions.length % 2 === 1;
                return (
                  <button
                    key={agent.id}
                    onClick={() => agent.redirectTo ? navigate(agent.redirectTo) : handleStart(agent)}
                    className={`group flex items-start gap-3 p-4 rounded-2xl border-2 bg-gradient-to-br text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] shadow-md ${agent.color} ${isLoneLast ? "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.375rem)]" : ""}`}
                    style={
                      animateLevelChange
                        ? { animation: `cardPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.06}s both` }
                        : undefined
                    }
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

            {/* Quick scenario access — solo en Nivel 1 */}
            {user && !isLevel2 && (
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
                size={isMobile ? "sm" : "lg"}
                energy
                speaking={false}
                listening={isConnecting}
                gradient={isLevel2 ? LEVEL2_ORB_GRADIENT : selectedAgent?.orbGradient}
              />
            </button>
            {sessionState === "connecting" && (
              <p className="text-sm text-muted-foreground">Preparando sesión...</p>
            )}
          </div>
        )}

        {/* ===== ACTIVE SESSION ===== */}
        {sessionState === "active" && (
          <div className="flex flex-col items-center justify-center w-full h-full px-4 pb-32 lg:pb-24 animate-fade-in">
            <div className="flex flex-col items-center gap-3 sm:gap-6">
              {/* Persona name (Álvaro / Nelson) */}
              {selectedAgent && (
                <p
                  className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/70"
                  style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                >
                  Personaje · {currentLevel === 1 ? "Álvaro" : "Alvaro"}
                </p>
              )}
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

              {!isFreeTier && <PracticeTimer totalSeconds={demoCall ? demoSecs : sessionTime} />}

              <AICompanionOrb speaking={demoCall ? demoSpeaking : isSpeaking} listening={demoCall ? !demoSpeaking : !isMuted} size={isMobile ? "sm" : "lg"} energy gradient={isLevel2 ? LEVEL2_ORB_GRADIENT : selectedAgent?.orbGradient} />
            </div>

            <div className="fixed left-1/2 -translate-x-1/2 z-40 bottom-24 lg:bottom-8">
              <VoiceControls
                isMuted={demoCall ? false : isMuted}
                onMuteToggle={demoCall ? () => {} : toggleMute}
                onEndCall={demoCall ? () => {} : handleEndCall}
              />
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
        @keyframes cardPop {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default Practice;
