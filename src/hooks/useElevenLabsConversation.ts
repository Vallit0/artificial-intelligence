import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api-client";

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

export type LatencyEventType = "connect" | "ttfa";

export interface LatencyEvent {
  type: LatencyEventType;
  ms: number;
  at: number;
}

export interface LatencyStats {
  connectMs: number | null;
  lastTtfaMs: number | null;
  avgTtfaMs: number | null;
  ttfaSamples: number;
}

interface UseElevenLabsConversationOptions {
  scenarioId?: string | null;
  sessionId?: string | null;
  agentSecretName?: string | null;
  userId?: string | null;
  userName?: string | null;
  onTranscript?: (text: string, isUser: boolean) => void;
  onEvaluation?: (evaluation: EvaluationResult) => void;
  onError?: (error: string) => void;
  onAgentDisconnected?: (reason?: string) => void;
  onLatency?: (event: LatencyEvent) => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions = {}) => {
  const onTranscriptRef = useRef(options.onTranscript);
  const onEvaluationRef = useRef(options.onEvaluation);
  const onErrorRef = useRef(options.onError);
  const onAgentDisconnectedRef = useRef(options.onAgentDisconnected);
  const onLatencyRef = useRef(options.onLatency);
  const userInitiatedDisconnectRef = useRef(false);
  const scenarioIdRef = useRef(options.scenarioId);
  const sessionIdRef = useRef(options.sessionId);
  const agentSecretNameRef = useRef(options.agentSecretName);
  const userIdRef = useRef(options.userId);
  const userNameRef = useRef(options.userName);

  useEffect(() => {
    // Invalidate prefetched URL when agent or scenario changes
    if (agentSecretNameRef.current !== options.agentSecretName || scenarioIdRef.current !== options.scenarioId) {
      prefetchedUrlRef.current = null;
    }
    onTranscriptRef.current = options.onTranscript;
    onEvaluationRef.current = options.onEvaluation;
    onErrorRef.current = options.onError;
    onAgentDisconnectedRef.current = options.onAgentDisconnected;
    onLatencyRef.current = options.onLatency;
    scenarioIdRef.current = options.scenarioId;
    sessionIdRef.current = options.sessionId;
    agentSecretNameRef.current = options.agentSecretName;
    userIdRef.current = options.userId;
    userNameRef.current = options.userName;
  }, [options.onTranscript, options.onEvaluation, options.onError, options.onAgentDisconnected, options.onLatency, options.scenarioId, options.sessionId, options.agentSecretName, options.userId, options.userName]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);
  const prefetchedUrlRef = useRef<string | null>(null);
  const prefetchedOverridesRef = useRef<{ prompt?: string; firstMessage?: string } | null>(null);
  const prefetchedVariantIdRef = useRef<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const memoryContextRef = useRef<string | null>(null);

  // Latency instrumentation
  const connectStartRef = useRef<number | null>(null);
  const userSpeechEndRef = useRef<number | null>(null);
  const ttfaSamplesRef = useRef<number[]>([]);
  const connectMsRef = useRef<number | null>(null);
  const [latencyStats, setLatencyStats] = useState<LatencyStats>({
    connectMs: null,
    lastTtfaMs: null,
    avgTtfaMs: null,
    ttfaSamples: 0,
  });

  const emitLatency = useCallback((type: LatencyEventType, ms: number) => {
    const rounded = Math.round(ms);
    const event: LatencyEvent = { type, ms: rounded, at: Date.now() };
    console.log(`[LATENCY] ${type}=${rounded}ms`);
    onLatencyRef.current?.(event);
    if (type === "connect") {
      connectMsRef.current = rounded;
    } else {
      ttfaSamplesRef.current.push(rounded);
    }
    setLatencyStats((prev) => {
      if (type === "connect") {
        return { ...prev, connectMs: rounded };
      }
      const samples = prev.ttfaSamples + 1;
      const total = (prev.avgTtfaMs ?? 0) * prev.ttfaSamples + rounded;
      return {
        ...prev,
        lastTtfaMs: rounded,
        avgTtfaMs: Math.round(total / samples),
        ttfaSamples: samples,
      };
    });
  }, []);

  const getLatencyReport = useCallback(() => ({
    connectMs: connectMsRef.current,
    ttfaSamplesMs: [...ttfaSamplesRef.current],
  }), []);

  const resetLatency = useCallback(() => {
    connectMsRef.current = null;
    ttfaSamplesRef.current = [];
    setLatencyStats({ connectMs: null, lastTtfaMs: null, avgTtfaMs: null, ttfaSamples: 0 });
  }, []);

  const handleSubmitEvaluation = useCallback((parameters: Record<string, unknown>): void => {
    console.log("[DEBUG][EVAL] submit_evaluation invoked via clientTools:", parameters);

    const hasLegacyShape =
      "score" in parameters ||
      "breakdown" in parameters ||
      "apertura" in parameters ||
      "escucha_activa" in parameters;

    const hasChecklistShape =
      "saludo_ok" in parameters ||
      "identificacion_ok" in parameters ||
      "justificacion_ok" in parameters ||
      "permiso_para_avanzar_ok" in parameters ||
      "ofrece_valor_legado_ok" in parameters ||
      "pide_cita_ok" in parameters;

    if (hasLegacyShape) {
      const p = parameters as {
        score?: number;
        passed?: boolean;
        feedback?: string;
        apertura?: number;
        escucha_activa?: number;
        manejo_objeciones?: number;
        propuesta_valor?: number;
        cierre?: number;
        breakdown?: {
          apertura?: number;
          escucha_activa?: number;
          manejo_objeciones?: number;
          propuesta_valor?: number;
          cierre?: number;
        };
      };
      const breakdown = {
        apertura: p.breakdown?.apertura ?? p.apertura ?? 0,
        escucha_activa: p.breakdown?.escucha_activa ?? p.escucha_activa ?? 0,
        manejo_objeciones: p.breakdown?.manejo_objeciones ?? p.manejo_objeciones ?? 0,
        propuesta_valor: p.breakdown?.propuesta_valor ?? p.propuesta_valor ?? 0,
        cierre: p.breakdown?.cierre ?? p.cierre ?? 0,
      };
      const evaluation: EvaluationResult = {
        score: p.score ?? 0,
        passed: p.passed ?? false,
        feedback: p.feedback ?? "",
        breakdown,
      };

      if (sessionIdRef.current) {
        api.post("/api/elevenlabs/agent-evaluation", {
          sessionId: sessionIdRef.current,
          ...evaluation,
        })
          .then((res) => console.log("[DEBUG][EVAL] POST /agent-evaluation OK", res))
          .catch((err) => console.error("[DEBUG][EVAL] POST /agent-evaluation ERROR", err));
      } else {
        console.warn("[DEBUG][EVAL] sessionId is null — evaluation will NOT be persisted");
      }

      onEvaluationRef.current?.(evaluation);
      return;
    }

    if (hasChecklistShape) {
      const toBool = (v: unknown) => v === 1 || v === "1" || v === true;
      const checks = {
        saludo_ok: toBool(parameters.saludo_ok),
        identificacion_ok: toBool(parameters.identificacion_ok),
        justificacion_ok: toBool(parameters.justificacion_ok),
        permiso_para_avanzar_ok: toBool(parameters.permiso_para_avanzar_ok),
        ofrece_valor_legado_ok: toBool(parameters.ofrece_valor_legado_ok),
        pide_cita_ok: toBool(parameters.pide_cita_ok),
      };
      const passedCount = Object.values(checks).filter(Boolean).length;
      const score = Math.round((passedCount / 6) * 100);
      const evaluation: EvaluationResult = {
        score,
        passed: score >= 50,
        feedback: `Checklist Legado de Vida: ${passedCount}/6 ítems cumplidos.`,
      };
      console.log("[DEBUG][EVAL] checklist evaluation (no DB persist yet):", { checks, evaluation });
      onEvaluationRef.current?.(evaluation);
      return;
    }

    console.warn("[DEBUG][EVAL] submit_evaluation: schema desconocido", parameters);
  }, []);

  const conversation = useConversation({
    micMuted: isMuted,
    clientTools: {
      submit_evaluation: handleSubmitEvaluation,
    },
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      if (connectStartRef.current !== null) {
        emitLatency("connect", performance.now() - connectStartRef.current);
        connectStartRef.current = null;
      }
      isConnectedRef.current = true;
      setIsConnecting(false);
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: (details: unknown) => {
      console.log("Disconnected from ElevenLabs agent, details:", JSON.stringify(details));
      const wasConnected = isConnectedRef.current;
      isConnectedRef.current = false;
      setIsMuted(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // If we were connected and the user did NOT trigger this disconnect,
      // the agent ended the call — notify the consumer so it can clean up.
      const reason = (details as { reason?: string } | undefined)?.reason;
      if (wasConnected && !userInitiatedDisconnectRef.current) {
        onAgentDisconnectedRef.current?.(reason);
      }
      userInitiatedDisconnectRef.current = false;
    },
    onStatusChange: ({ status }: { status: string }) => {
      console.log("[DEBUG] Status changed:", status);
    },
    onMessage: (message) => {
      const msg = message as unknown as {
        user_transcription_event?: { user_transcript?: string };
        agent_response_event?: { agent_response?: string };
        agent_response_correction_event?: { corrected_agent_response?: string };
      };

      if (msg.user_transcription_event?.user_transcript) {
        userSpeechEndRef.current = performance.now();
        if (onTranscriptRef.current) {
          onTranscriptRef.current(msg.user_transcription_event.user_transcript, true);
        }
      }

      if (msg.agent_response_event?.agent_response && onTranscriptRef.current) {
        onTranscriptRef.current(msg.agent_response_event.agent_response, false);
      }

      if (msg.agent_response_correction_event?.corrected_agent_response && onTranscriptRef.current) {
        console.log("Agent was interrupted, corrected response:", msg.agent_response_correction_event.corrected_agent_response);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs conversation error:", error);
      const errorMessage = typeof error === 'string' ? error : (error as Error)?.message || "Connection error";
      onErrorRef.current?.(errorMessage);
      setIsConnecting(false);
    },
  });

  // Pre-fetch signed URL and memory context when agent changes
  const prefetchSignedUrl = useCallback(async () => {
    try {
      const data = await api.post<{ signedUrl: string; scenario?: any; overrides?: { prompt?: string; firstMessage?: string } | null; variantId?: string }>("/api/elevenlabs/conversation-token", {
        scenarioId: scenarioIdRef.current,
        agentSecretName: agentSecretNameRef.current,
      });
      if (data?.signedUrl) {
        prefetchedUrlRef.current = data.signedUrl;
        prefetchedOverridesRef.current = data.overrides ?? null;
        prefetchedVariantIdRef.current = data.variantId ?? null;
        console.log("Signed URL pre-fetched for agent:", agentSecretNameRef.current);
      }
    } catch (error) {
      console.warn("Pre-fetch signed URL failed, will retry on connect:", error);
    }
  }, [options.agentSecretName, options.scenarioId]);

  const prefetchMemoryContext = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const data = await api.post<{ context: string }>("/api/memory/context", {
        user_id: userIdRef.current,
      });
      if (data?.context) {
        memoryContextRef.current = data.context;
        console.log("Memory context pre-fetched");
      }
    } catch (error) {
      console.warn("Pre-fetch memory context failed:", error);
    }
  }, []);

  // Pre-fetch on mount
  useEffect(() => {
    prefetchSignedUrl();
    prefetchMemoryContext();
  }, [prefetchSignedUrl, prefetchMemoryContext]);

  const connect = useCallback(async () => {
    if (isConnectedRef.current || isConnecting) {
      console.log("Already connected or connecting, skipping");
      return;
    }

    setIsConnecting(true);
    setSessionTime(0);
    setIsMuted(false);
    connectStartRef.current = performance.now();
    userSpeechEndRef.current = null;
    connectMsRef.current = null;
    ttfaSamplesRef.current = [];
    setLatencyStats({ connectMs: null, lastTtfaMs: null, avgTtfaMs: null, ttfaSamples: 0 });

    try {
      // Use pre-fetched URL if available, otherwise fetch now
      const hasPreFetched = !!prefetchedUrlRef.current;

      let data: { signedUrl: string; scenario?: any; overrides?: { prompt?: string; firstMessage?: string } | null; variantId?: string };

      if (hasPreFetched) {
        data = {
          signedUrl: prefetchedUrlRef.current!,
          overrides: prefetchedOverridesRef.current,
          variantId: prefetchedVariantIdRef.current ?? undefined,
        };
      } else {
        data = await api.post<{ signedUrl: string; scenario?: any; overrides?: { prompt?: string; firstMessage?: string } | null; variantId?: string }>("/api/elevenlabs/conversation-token", {
          scenarioId: scenarioIdRef.current,
          agentSecretName: agentSecretNameRef.current,
        });
      }

      prefetchedUrlRef.current = null; // Consumed
      prefetchedOverridesRef.current = null;
      prefetchedVariantIdRef.current = null;

      // Expose variant ID for A/B testing
      setVariantId(data.variantId ?? null);

      if (!data?.signedUrl) {
        throw new Error("No signed URL received from server");
      }

      // Build dynamic variables with memory context
      const dynamicVariables: Record<string, string> = {};
      if (userIdRef.current) {
        dynamicVariables.user_id = userIdRef.current;
      }
      dynamicVariables.advisor_name = userNameRef.current || "Visitante";
      if (memoryContextRef.current) {
        dynamicVariables.advisor_context = memoryContextRef.current;
      }

      // Admin-configured prompt/firstMessage overrides for prospecting agents
      const sessionOverrides: any = {};
      if (data.overrides?.prompt || data.overrides?.firstMessage) {
        sessionOverrides.agent = {};
        if (data.overrides.prompt) {
          sessionOverrides.agent.prompt = { prompt: data.overrides.prompt };
        }
        if (data.overrides.firstMessage) {
          sessionOverrides.agent.firstMessage = data.overrides.firstMessage;
        }
      }

      // Let the SDK handle microphone access internally
      await conversation.startSession({
        signedUrl: data.signedUrl,
        dynamicVariables,
        ...(Object.keys(sessionOverrides).length > 0 ? { overrides: sessionOverrides } : {}),
      });

      // Pre-fetch next URL for quick reconnect
      prefetchSignedUrl();
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onErrorRef.current?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [conversation, isConnecting, prefetchSignedUrl]);

  const disconnect = useCallback(async () => {
    console.log("Disconnect called");
    userInitiatedDisconnectRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await conversation.endSession();
    } catch (error) {
      console.error("Error ending session:", error);
    }

    isConnectedRef.current = false;
    setSessionTime(0);
    setIsMuted(false);
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // TTFA: measure from last user-transcript event to the moment the agent starts speaking
  useEffect(() => {
    if (conversation.isSpeaking && userSpeechEndRef.current !== null) {
      emitLatency("ttfa", performance.now() - userSpeechEndRef.current);
      userSpeechEndRef.current = null;
    }
  }, [conversation.isSpeaking, emitLatency]);

  return {
    isConnected: conversation.status === "connected",
    isConnecting,
    isSpeaking: conversation.isSpeaking,
    isMuted,
    sessionTime,
    variantId,
    latencyStats,
    getLatencyReport,
    resetLatency,
    connect,
    disconnect,
    toggleMute,
  };
};
