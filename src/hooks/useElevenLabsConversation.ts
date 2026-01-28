import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  onTranscript?: (text: string, isUser: boolean) => void;
  onEvaluation?: (evaluation: EvaluationResult) => void;
  onError?: (error: string) => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions = {}) => {
  // Use refs for callbacks to prevent hook recreation
  const onTranscriptRef = useRef(options.onTranscript);
  const onEvaluationRef = useRef(options.onEvaluation);
  const onErrorRef = useRef(options.onError);
  const scenarioIdRef = useRef(options.scenarioId);
  const sessionIdRef = useRef(options.sessionId);
  
  // Update refs when options change
  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
    onEvaluationRef.current = options.onEvaluation;
    onErrorRef.current = options.onError;
    scenarioIdRef.current = options.scenarioId;
    sessionIdRef.current = options.sessionId;
  }, [options.onTranscript, options.onEvaluation, options.onError, options.scenarioId, options.sessionId]);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      isConnectedRef.current = true;
      setIsConnecting(false);
      // Start session timer
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      isConnectedRef.current = false;
      setIsMuted(false);
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Cleanup media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log("Message from agent:", message);
      
      // Handle transcriptions
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

      // Handle interruption correction
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

        // Save evaluation to database via edge function
        if (sessionIdRef.current) {
          supabase.functions.invoke("agent-evaluation", {
            body: {
              session_id: sessionIdRef.current,
              ...evaluation,
            },
          }).then(({ error }) => {
            if (error) {
              console.error("Error saving evaluation:", error);
            }
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

  const connect = useCallback(async () => {
    if (isConnectedRef.current || isConnecting) {
      console.log("Already connected or connecting, skipping");
      return;
    }
    
    setIsConnecting(true);
    setSessionTime(0);
    setIsMuted(false);

    try {
      // Request microphone permission with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        } 
      });
      mediaStreamRef.current = stream;

      // Get signed URL from edge function with scenario
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        {
          body: { scenario_id: scenarioIdRef.current },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to get conversation token");
      }

      console.log("Edge function response:", data);

      if (!data?.signedUrl) {
        throw new Error("No signed URL received from server");
      }

      // Start the conversation with WebSocket using signed URL
      console.log("Starting session with signed URL...");
      await conversation.startSession({
        signedUrl: data.signedUrl,
      });

      console.log("Session started successfully");
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onErrorRef.current?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
      // Cleanup on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [conversation, isConnecting]);

  const disconnect = useCallback(async () => {
    console.log("Disconnect called");
    
    // Stop timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Cleanup media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    
    // End the session
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
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
      console.log("Microphone muted:", !audioTracks[0]?.enabled);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
