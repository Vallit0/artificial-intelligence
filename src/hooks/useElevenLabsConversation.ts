import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseElevenLabsConversationOptions {
  scenarioId?: string | null;
  onTranscript?: (text: string, isUser: boolean) => void;
  onError?: (error: string) => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions = {}) => {
  const { scenarioId, onTranscript, onError } = options;
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      // Start session timer
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log("Message from agent:", message);
      
      // Handle transcriptions - cast to unknown first then to our expected structure
      const msg = message as unknown as { 
        user_transcription_event?: { user_transcript?: string };
        agent_response_event?: { agent_response?: string };
      };
      
      if (msg.user_transcription_event?.user_transcript && onTranscript) {
        onTranscript(msg.user_transcription_event.user_transcript, true);
      }
      
      if (msg.agent_response_event?.agent_response && onTranscript) {
        onTranscript(msg.agent_response_event.agent_response, false);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs conversation error:", error);
      const errorMessage = typeof error === 'string' ? error : (error as Error)?.message || "Connection error";
      onError?.(errorMessage);
      setIsConnecting(false);
    },
  });

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setSessionTime(0);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function with scenario
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        {
          body: { scenario_id: scenarioId },
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
      await conversation.startSession({
        signedUrl: data.signedUrl,
      });

      setIsConnecting(false);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onError?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [conversation, onError, scenarioId]);

  const disconnect = useCallback(async () => {
    await conversation.endSession();
    setSessionTime(0);
  }, [conversation]);

  const toggleMute = useCallback(() => {
    // ElevenLabs SDK doesn't have a direct mute toggle
    // We would need to stop/start the audio track
    console.log("Mute toggle not directly supported by ElevenLabs SDK");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      conversation.endSession();
    };
  }, [conversation]);

  return {
    isConnected: conversation.status === "connected",
    isConnecting,
    isSpeaking: conversation.isSpeaking,
    isMuted: false, // ElevenLabs doesn't expose this directly
    sessionTime,
    connect,
    disconnect,
    toggleMute,
  };
};
