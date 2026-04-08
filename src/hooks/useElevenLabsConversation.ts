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

interface UseElevenLabsConversationOptions {
  scenarioId?: string | null;
  sessionId?: string | null;
  agentSecretName?: string | null;
  userId?: string | null;
  userName?: string | null;
  onTranscript?: (text: string, isUser: boolean) => void;
  onEvaluation?: (evaluation: EvaluationResult) => void;
  onError?: (error: string) => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions = {}) => {
  const onTranscriptRef = useRef(options.onTranscript);
  const onEvaluationRef = useRef(options.onEvaluation);
  const onErrorRef = useRef(options.onError);
  const scenarioIdRef = useRef(options.scenarioId);
  const sessionIdRef = useRef(options.sessionId);
  const agentSecretNameRef = useRef(options.agentSecretName);
  const userIdRef = useRef(options.userId);
  const userNameRef = useRef(options.userName);

  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
    onEvaluationRef.current = options.onEvaluation;
    onErrorRef.current = options.onError;
    scenarioIdRef.current = options.scenarioId;
    sessionIdRef.current = options.sessionId;
    agentSecretNameRef.current = options.agentSecretName;
    userIdRef.current = options.userId;
    userNameRef.current = options.userName;
  }, [options.onTranscript, options.onEvaluation, options.onError, options.scenarioId, options.sessionId, options.agentSecretName, options.userId, options.userName]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const prefetchedUrlRef = useRef<string | null>(null);
  const memoryContextRef = useRef<string | null>(null);

  const conversation = useConversation({
    micMuted: isMuted,
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      isConnectedRef.current = true;
      setIsConnecting(false);
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      isConnectedRef.current = false;
      setIsMuted(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log("Message from agent:", message);

      const msg = message as unknown as {
        user_transcription_event?: { user_transcript?: string };
        agent_response_event?: { agent_response?: string };
        agent_response_correction_event?: { corrected_agent_response?: string };
        client_tool_call?: {
          tool_name: string;
          tool_call_id: string;
          parameters: Record<string, unknown>;
        };
      };

      if (msg.user_transcription_event?.user_transcript && onTranscriptRef.current) {
        onTranscriptRef.current(msg.user_transcription_event.user_transcript, true);
      }

      if (msg.agent_response_event?.agent_response && onTranscriptRef.current) {
        onTranscriptRef.current(msg.agent_response_event.agent_response, false);
      }

      if (msg.agent_response_correction_event?.corrected_agent_response && onTranscriptRef.current) {
        console.log("Agent was interrupted, corrected response:", msg.agent_response_correction_event.corrected_agent_response);
      }

      // Handle evaluation client tool call from ElevenLabs agent
      if (msg.client_tool_call?.tool_name === "submit_evaluation") {
        const params = msg.client_tool_call.parameters as {
          score?: number;
          passed?: boolean;
          feedback?: string;
          apertura?: number;
          escucha_activa?: number;
          manejo_objeciones?: number;
          propuesta_valor?: number;
          cierre?: number;
        };

        console.log("Received evaluation from agent:", params);

        const evaluation: EvaluationResult = {
          score: params.score ?? 0,
          passed: params.passed ?? false,
          feedback: params.feedback ?? "",
          breakdown: {
            apertura: params.apertura ?? 0,
            escucha_activa: params.escucha_activa ?? 0,
            manejo_objeciones: params.manejo_objeciones ?? 0,
            propuesta_valor: params.propuesta_valor ?? 0,
            cierre: params.cierre ?? 0,
          },
        };

        // Save evaluation via API
        if (sessionIdRef.current) {
          api.post("/api/elevenlabs/agent-evaluation", {
            sessionId: sessionIdRef.current,
            ...evaluation,
          }).catch((error) => {
            console.error("Error saving evaluation:", error);
          });
        }

        onEvaluationRef.current?.(evaluation);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs conversation error:", error);
      const errorMessage = typeof error === 'string' ? error : (error as Error)?.message || "Connection error";
      onErrorRef.current?.(errorMessage);
      setIsConnecting(false);
    },
  });

  // Pre-fetch signed URL and memory context on mount
  const prefetchSignedUrl = useCallback(async () => {
    try {
      const data = await api.post<{ signedUrl: string; scenario?: any }>("/api/elevenlabs/conversation-token", {
        scenarioId: scenarioIdRef.current,
        agentSecretName: agentSecretNameRef.current,
      });
      if (data?.signedUrl) {
        prefetchedUrlRef.current = data.signedUrl;
        console.log("Signed URL pre-fetched");
      }
    } catch (error) {
      console.warn("Pre-fetch signed URL failed, will retry on connect:", error);
    }
  }, []);

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

    try {
      // Check for secure context (getUserMedia requires HTTPS or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso al micrófono. Asegúrate de usar HTTPS.");
      }

      // Use pre-fetched URL if available, otherwise fetch in parallel with mic
      const hasPreFetched = !!prefetchedUrlRef.current;

      let rawStream: MediaStream;
      let data: { signedUrl: string; scenario?: any };

      try {
        [rawStream, data] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
              sampleRate: { ideal: 16000 },
              channelCount: { ideal: 1 },
            },
          }),
          hasPreFetched
            ? Promise.resolve({ signedUrl: prefetchedUrlRef.current! })
            : api.post<{ signedUrl: string; scenario?: any }>("/api/elevenlabs/conversation-token", {
                scenarioId: scenarioIdRef.current,
                agentSecretName: agentSecretNameRef.current,
              }),
        ]);
      } catch (micError: any) {
        if (micError?.name === "NotAllowedError") {
          throw new Error("Permiso de micrófono denegado. Habilita el acceso al micrófono en tu navegador.");
        } else if (micError?.name === "NotFoundError") {
          throw new Error("No se encontró un micrófono. Conecta un micrófono e intenta de nuevo.");
        }
        throw micError;
      }

      rawStreamRef.current = rawStream;
      prefetchedUrlRef.current = null; // Consumed

      if (!data?.signedUrl) {
        throw new Error("No signed URL received from server");
      }

      // Build dynamic variables with memory context
      const dynamicVariables: Record<string, string> = {};
      if (userIdRef.current) {
        dynamicVariables.user_id = userIdRef.current;
      }
      if (userNameRef.current) {
        dynamicVariables.advisor_name = userNameRef.current;
      }
      if (memoryContextRef.current) {
        dynamicVariables.advisor_context = memoryContextRef.current;
      }

      console.log("Starting session with signed URL...");
      await conversation.startSession({
        signedUrl: data.signedUrl,
        overrides: {
          device: { stream: rawStream }, // Raw stream — no filter/compressor overhead
          tts: {
            speed: 1.1,
            stability: 0.4,
            similarityBoost: 0.7,
          },
        },
        dynamicVariables,
      });

      // Pre-fetch next URL for quick reconnect
      prefetchSignedUrl();

      console.log("Session started successfully");
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onErrorRef.current?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [conversation, isConnecting, prefetchSignedUrl]);

  const disconnect = useCallback(async () => {
    console.log("Disconnect called");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await conversation.endSession();
    } catch (error) {
      console.error("Error ending session:", error);
    }

    // Stop raw microphone stream
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
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
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isConnected: conversation.status === "connected",
    isConnecting,
    isSpeaking: conversation.isSpeaking,
    isMuted,
    sessionTime,
    connect,
    disconnect,
    toggleMute,
  };
};
