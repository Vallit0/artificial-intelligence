import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);

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
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log("Message from agent:", message);
      
      // Handle transcriptions
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
    if (isConnectedRef.current || isConnecting) {
      console.log("Already connected or connecting, skipping");
      return;
    }
    
    setIsConnecting(true);
    setSessionTime(0);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function with scenario
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
      console.log("Starting session with signed URL...");
      await conversation.startSession({
        signedUrl: data.signedUrl,
      });

      console.log("Session started successfully");
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onError?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [conversation, onError, scenarioId, isConnecting]);

  const disconnect = useCallback(async () => {
    console.log("Disconnect called");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await conversation.endSession();
    setSessionTime(0);
  }, [conversation]);

  return {
    isConnected: conversation.status === "connected",
    isConnecting,
    isSpeaking: conversation.isSpeaking,
    isMuted: false,
    sessionTime,
    connect,
    disconnect,
    toggleMute: () => console.log("Mute not supported"),
  };
};
