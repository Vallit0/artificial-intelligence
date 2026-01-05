import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseRealtimeAudioOptions {
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onTranscript?: (text: string, isUser: boolean) => void;
  onError?: (error: string) => void;
}

export const useRealtimeAudio = (options: UseRealtimeAudioOptions = {}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);

    try {
      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Set up audio element for remote audio
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      
      pc.ontrack = (e) => {
        console.log("Received remote track");
        audioEl.srcObject = e.streams[0];
        setIsSpeaking(true);
        options.onSpeakingChange?.(true);
      };

      // Get local audio and add to peer connection
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);

      // Set up data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("Data channel opened");
        setIsConnected(true);
        setIsConnecting(false);

        // Start timer
        timerRef.current = setInterval(() => {
          setSessionTime((prev) => prev + 1);
        }, 1000);

        // Make AI speak first
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        console.log("Received event:", event.type);

        if (event.type === "response.audio.delta") {
          setIsSpeaking(true);
          options.onSpeakingChange?.(true);
        }

        if (event.type === "response.audio.done") {
          setIsSpeaking(false);
          options.onSpeakingChange?.(false);
        }

        if (event.type === "response.audio_transcript.done") {
          options.onTranscript?.(event.transcript || "", false);
        }

        if (event.type === "conversation.item.input_audio_transcription.completed") {
          options.onTranscript?.(event.transcript || "", true);
        }

        if (event.type === "error") {
          console.error("API error:", event.error);
          toast({
            variant: "destructive",
            title: "Error",
            description: event.error?.message || "Error en la conexión",
          });
        }
      };

      dc.onerror = (error) => {
        console.error("Data channel error:", error);
      };

      // Create offer and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("Sending SDP to edge function...");

      // Send SDP to our edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-session`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge function error:", errorText);
        throw new Error("No se pudo establecer la sesión");
      }

      const answerSdp = await response.text();
      console.log("Received SDP answer");

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };
      await pc.setRemoteDescription(answer);
      console.log("WebRTC connection established");

    } catch (error) {
      console.error("Connection error:", error);
      setIsConnecting(false);
      setIsConnected(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar",
      });
    }
  }, [toast, options]);

  const disconnect = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);

    toast({
      title: "Sesión terminada",
      description: `Tiempo de práctica: ${Math.floor(sessionTime / 60)} minutos`,
    });
  }, [sessionTime, toast]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dcRef.current) dcRef.current.close();
      if (pcRef.current) pcRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    sessionTime,
    connect,
    disconnect,
    toggleMute,
  };
};