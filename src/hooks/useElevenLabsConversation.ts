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
  // Desglose por ítem del checklist de Prospección (Legado de Vida). Cada
  // entrada es uno de los criterios de la tool submit_evaluation con su
  // resultado, para mostrar en pantalla el motivo concreto del rechazo.
  checklist?: { label: string; passed: boolean }[];
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
  // Umbral de aprobación (score 0-100) que gatea el certificado/avance en la UI.
  // Debe coincidir con el umbral autoritativo del backend (passThresholdForExam):
  // Objeciones=80, Prospección/práctica=75. Si se omite, default 75.
  passThreshold?: number;
  // Duración máxima de la llamada en segundos. Al alcanzarla, se dispara
  // onMaxDuration una sola vez (la página decide cómo cerrar: la práctica
  // termina la llamada, el examen finaliza y evalúa). Si se omite o es null/0,
  // no hay límite. Prospección usa 300 (5 min) y Objeciones 600 (10 min).
  maxDurationSec?: number | null;
  onMaxDuration?: () => void;
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
  const passThresholdRef = useRef(options.passThreshold);
  const maxDurationSecRef = useRef(options.maxDurationSec);
  const onMaxDurationRef = useRef(options.onMaxDuration);
  // One-shot guard: el cierre por tiempo se dispara una sola vez por sesión.
  const maxReachedRef = useRef(false);

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
    passThresholdRef.current = options.passThreshold;
    maxDurationSecRef.current = options.maxDurationSec;
    onMaxDurationRef.current = options.onMaxDuration;
  }, [options.onTranscript, options.onEvaluation, options.onError, options.onAgentDisconnected, options.onLatency, options.scenarioId, options.sessionId, options.agentSecretName, options.userId, options.userName, options.passThreshold, options.maxDurationSec, options.onMaxDuration]);

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

  // Tracks the in-flight POST to /api/elevenlabs/agent-evaluation so callers
  // can await DB persistence before invoking endpoints (like unlock-level2)
  // that read `passed` straight from the session row. Errors propagate so
  // handleContinue can surface them and skip the unlock instead of racing
  // into a 403.
  const evaluationPersistRef = useRef<Promise<unknown> | null>(null);
  const awaitEvaluationPersist = useCallback(async (): Promise<void> => {
    const p = evaluationPersistRef.current;
    if (!p) return;
    await p;
  }, []);

  const resetLatency = useCallback(() => {
    connectMsRef.current = null;
    ttfaSamplesRef.current = [];
    setLatencyStats({ connectMs: null, lastTtfaMs: null, avgTtfaMs: null, ttfaSamples: 0 });
  }, []);

  // Mecanismo compartido por ambos exámenes: a partir de la forma de 5 rúbricas
  // recomputa score/passed (ignorando lo que afirme el agente), persiste la
  // nota en /api/elevenlabs/agent-evaluation y notifica a la página que el
  // examen terminó. Es el "qué pasa cuando se recibe la nota": idéntico para
  // Prospección y Objeciones, pero cada tool entra por su propio handler.
  const persistRubricEvaluation = useCallback((parameters: Record<string, unknown>): void => {
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
    // El servidor valida cada rúbrica en 0–20 con zod (elevenlabs.controller.ts)
    // y rechaza con 400 cualquier otra cosa. PERO las tools de ElevenLabs
    // (submit_evaluation[_objeciones].tool.json) le piden al agente cada
    // dimensión en escala 0–100, no 0–20. Truncar (clamp) 0–100 → 0–20 hacía
    // que toda rúbrica ≥20 cayera a 20, dando score=100 casi siempre: ese era
    // el bug del "100 fijo". Aquí reescalamos en vez de truncar.
    const raw = {
      apertura: p.breakdown?.apertura ?? p.apertura ?? 0,
      escucha_activa: p.breakdown?.escucha_activa ?? p.escucha_activa ?? 0,
      manejo_objeciones: p.breakdown?.manejo_objeciones ?? p.manejo_objeciones ?? 0,
      propuesta_valor: p.breakdown?.propuesta_valor ?? p.propuesta_valor ?? 0,
      cierre: p.breakdown?.cierre ?? p.cierre ?? 0,
    };
    // Detecta la escala: si alguna rúbrica supera 20, el agente está usando la
    // escala 0–100 de la tool y hay que dividir entre 5 para mapear a 0–20. Si
    // todas ya están en 0–20, se usan tal cual (variantes que ya envían 0–20).
    const isHundredScale = Object.values(raw).some((n) => Number(n) > 20);
    const toRubric = (n: unknown) => {
      const num = Number(n) || 0;
      const scaled = isHundredScale ? num / 5 : num;
      return Math.max(0, Math.min(20, Math.round(scaled)));
    };
    console.log("[DEBUG][EVAL] rúbricas crudas del agente:", raw, "→ escala", isHundredScale ? "0-100 (÷5)" : "0-20");
    const breakdown = {
      apertura: toRubric(raw.apertura),
      escucha_activa: toRubric(raw.escucha_activa),
      manejo_objeciones: toRubric(raw.manejo_objeciones),
      propuesta_valor: toRubric(raw.propuesta_valor),
      cierre: toRubric(raw.cierre),
    };
    // Mirror the server-side recompute (elevenlabs.controller.ts:124-132):
    // score/passed are derived from the breakdown, ignoring whatever the
    // agent claims. Trusting `p.passed` here was the bug that surfaced
    // "Avanzar de nivel" while the DB row still had passed:false → 403 on
    // /api/users/me/unlock-level2.
    const score =
      breakdown.apertura +
      breakdown.escucha_activa +
      breakdown.manejo_objeciones +
      breakdown.propuesta_valor +
      breakdown.cierre;
    // Umbral por examen, igual que el backend (passThresholdForExam):
    // Objeciones=80, Prospección=75. Default 75 si la página no lo pasa.
    const passThreshold = passThresholdRef.current ?? 75;
    const passed = score >= passThreshold;
    const evaluation: EvaluationResult = {
      score,
      passed,
      feedback: (p.feedback ?? "").trim() || "Sin comentarios del agente.",
      breakdown,
    };

    if (sessionIdRef.current) {
      const persist = api.post("/api/elevenlabs/agent-evaluation", {
        sessionId: sessionIdRef.current,
        ...evaluation,
      });
      evaluationPersistRef.current = persist;
      persist
        .then((res) => console.log("[DEBUG][EVAL] POST /agent-evaluation OK", res))
        .catch((err) => console.error("[DEBUG][EVAL] POST /agent-evaluation ERROR", err));
    } else {
      console.warn("[DEBUG][EVAL] sessionId is null — evaluation will NOT be persisted");
    }

    onEvaluationRef.current?.(evaluation);
  }, []);

  // Tool del examen de Prospección (Nivel 1) + checklist de Legado de Vida.
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
      "uso_frases_neutralizantes_ok" in parameters ||
      "ofrece_valor_legado_ok" in parameters ||
      "pide_cita_ok" in parameters;

    if (hasLegacyShape) {
      persistRubricEvaluation(parameters);
      return;
    }

    if (hasChecklistShape) {
      const toBool = (v: unknown) => v === 1 || v === "1" || v === true;
      const checks = {
        saludo_ok: toBool(parameters.saludo_ok),
        identificacion_ok: toBool(parameters.identificacion_ok),
        justificacion_ok: toBool(parameters.justificacion_ok),
        uso_frases_neutralizantes_ok: toBool(parameters.uso_frases_neutralizantes_ok),
        ofrece_valor_legado_ok: toBool(parameters.ofrece_valor_legado_ok),
        pide_cita_ok: toBool(parameters.pide_cita_ok),
      };
      const passedCount = Object.values(checks).filter(Boolean).length;
      const score = Math.round((passedCount / 6) * 100);
      const llmFeedback = typeof parameters.feedback === "string" ? parameters.feedback.trim() : "";
      // Etiquetas legibles por ítem para mostrar en pantalla qué criterios se
      // cumplieron y cuáles no (el "motivo del rechazo" que pide la tool).
      const checklistLabels: Record<keyof typeof checks, string> = {
        saludo_ok: "Saludo",
        identificacion_ok: "Identificación (nombre + Señoriales)",
        justificacion_ok: "Justificación del motivo",
        uso_frases_neutralizantes_ok: "Uso de frases neutralizantes",
        ofrece_valor_legado_ok: "Presenta Legado de Vida",
        pide_cita_ok: "Pide cita",
      };
      const checklist = (Object.keys(checks) as (keyof typeof checks)[]).map((key) => ({
        label: checklistLabels[key],
        passed: checks[key],
      }));
      const evaluation: EvaluationResult = {
        score,
        passed: score >= 75,
        feedback: llmFeedback || `Checklist Legado de Vida: ${passedCount}/6 ítems cumplidos.`,
        checklist,
      };
      console.log("[DEBUG][EVAL] checklist evaluation (no DB persist yet):", { checks, evaluation });
      onEvaluationRef.current?.(evaluation);
      return;
    }

    console.warn("[DEBUG][EVAL] submit_evaluation: schema desconocido", parameters);
  }, [persistRubricEvaluation]);

  // Tool del examen de Manejo de Objeciones (Nivel 2). Evalúa los 5 pasos del
  // método de replanteamiento de objeciones (Replanteamiento → Investigar →
  // Aislar → Responder → Continuar), no las 5 rúbricas genéricas de Prospección.
  //
  // El backend (elevenlabs.controller.ts) sólo acepta un breakdown con las 5
  // llaves fijas apertura/escucha_activa/manejo_objeciones/propuesta_valor/cierre
  // en 0–20, y ese endpoint /agent-evaluation lo comparten ambos exámenes. Para
  // reusarlo sin migrar el schema (ni romper Prospección), cada criterio nuevo
  // se guarda en un "slot" fijo del breakdown. El score autoritativo sigue siendo
  // la suma de los 5 slots (0–100). El nombre real de cada paso se muestra al
  // alumno vía `checklist` (labels correctos), no vía el desglose legacy.
  const OBJECIONES_CRITERIA = [
    { id: "replanteamiento", slot: "apertura", label: "Replanteamiento de Objeciones" },
    { id: "investigar", slot: "escucha_activa", label: "Investigar" },
    { id: "aislar", slot: "manejo_objeciones", label: "Aislar (Identificar la objeción)" },
    { id: "responder", slot: "propuesta_valor", label: "Responder (3F · Historias de 3ras personas · Secuencias de cierre)" },
    { id: "continuar", slot: "cierre", label: "Continuar" },
  ] as const;

  const handleSubmitObjecionesEvaluation = useCallback((parameters: Record<string, unknown>): void => {
    console.log("[DEBUG][EVAL] submit_evaluation_objeciones invoked via clientTools:", parameters);
    const p = parameters as Record<string, unknown> & { breakdown?: Record<string, unknown> };

    // Cada criterio llega en 0–100 (plano o dentro de breakdown). Reescalamos a
    // 0–20 (÷5) para el slot que el backend valida con zod.
    const raw100Of = (id: string) => Number(p.breakdown?.[id] ?? p[id] ?? 0) || 0;
    const to20 = (n: number) => Math.max(0, Math.min(20, Math.round(n / 5)));

    const breakdown = {
      apertura: 0,
      escucha_activa: 0,
      manejo_objeciones: 0,
      propuesta_valor: 0,
      cierre: 0,
    } as Record<string, number>;
    const checklist: { label: string; passed: boolean }[] = [];

    for (const c of OBJECIONES_CRITERIA) {
      const raw100 = raw100Of(c.id);
      const val20 = to20(raw100);
      breakdown[c.slot] = val20;
      // Un paso se considera "cumplido" a partir de 60/100 (=12/20).
      checklist.push({ label: `${c.label} — ${val20}/20`, passed: raw100 >= 60 });
    }

    // Score/passed recomputados desde el breakdown, ignorando lo que afirme el
    // agente (mismo criterio que persistRubricEvaluation y el backend).
    const score =
      breakdown.apertura +
      breakdown.escucha_activa +
      breakdown.manejo_objeciones +
      breakdown.propuesta_valor +
      breakdown.cierre;
    const passThreshold = passThresholdRef.current ?? 80;
    const passed = score >= passThreshold;
    const feedback = (typeof p.feedback === "string" ? p.feedback.trim() : "") || "Sin comentarios del agente.";

    console.log("[DEBUG][EVAL][objeciones] criterios → breakdown:", { checklist, breakdown, score, passed });

    // Persistimos el breakdown en slots legacy para que el backend lo acepte y
    // la nota caiga en la columna de Objeciones. La UI recibe el `checklist`
    // (nombres reales de los 5 pasos) en vez del desglose con labels legacy.
    if (sessionIdRef.current) {
      const persist = api.post("/api/elevenlabs/agent-evaluation", {
        sessionId: sessionIdRef.current,
        score,
        passed,
        feedback,
        breakdown,
      });
      evaluationPersistRef.current = persist;
      persist
        .then((res) => console.log("[DEBUG][EVAL] POST /agent-evaluation OK", res))
        .catch((err) => console.error("[DEBUG][EVAL] POST /agent-evaluation ERROR", err));
    } else {
      console.warn("[DEBUG][EVAL] sessionId is null — evaluación no se persistirá");
    }

    onEvaluationRef.current?.({ score, passed, feedback, checklist });
  }, []);

  const conversation = useConversation({
    micMuted: isMuted,
    clientTools: {
      // El examen de Prospección (Nivel 1) llama submit_evaluation; el de
      // Objeciones (Nivel 2) llama submit_evaluation_objeciones. Cada uno entra
      // por su propio handler, pero ambos comparten persistRubricEvaluation:
      // postean a /api/elevenlabs/agent-evaluation con el sessionId de la
      // conversación, cuya fila ya trae el examType correcto para el passback.
      submit_evaluation: handleSubmitEvaluation,
      submit_evaluation_objeciones: handleSubmitObjecionesEvaluation,
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
    maxReachedRef.current = false;
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

  // Auto-cierre por límite de duración. Cuando la sesión activa alcanza
  // maxDurationSec, dispara onMaxDuration una sola vez. El hook no termina la
  // sesión por su cuenta: la página decide cómo cerrar (la práctica cuelga; el
  // examen finaliza y evalúa) llamando a su propio handler desde onMaxDuration.
  useEffect(() => {
    const max = maxDurationSecRef.current;
    if (!max || max <= 0) return;
    if (isConnectedRef.current && sessionTime >= max && !maxReachedRef.current) {
      maxReachedRef.current = true;
      onMaxDurationRef.current?.();
    }
  }, [sessionTime]);

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
    awaitEvaluationPersist,
  };
};
