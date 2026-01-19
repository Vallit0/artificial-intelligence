import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseElevenLabsConversationOptions {
  onTranscript?: (text: string, isUser: boolean) => void;
  onError?: (error: string) => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions = {}) => {
  const { onTranscript, onError } = options;
  
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
      
      // Handle transcriptions - check message structure
      const msg = message as Record<string, unknown>;
      if (msg.user_transcription_event && onTranscript) {
        const transcript = (msg.user_transcription_event as Record<string, unknown>)?.user_transcript as string;
        if (transcript) {
          onTranscript(transcript, true);
        }
      }
      
      if (msg.agent_response_event && onTranscript) {
        const response = (msg.agent_response_event as Record<string, unknown>)?.agent_response as string;
        if (response) {
          onTranscript(response, false);
        }
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

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error) {
        throw new Error(error.message || "Failed to get conversation token");
      }

      if (!data?.token) {
        throw new Error("No token received from server");
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });

      setIsConnecting(false);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      onError?.(error instanceof Error ? error.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [conversation, onError]);

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
