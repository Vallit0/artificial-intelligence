import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
}

interface UseScribeRealtimeOptions {
  onPartialTranscript?: (text: string) => void;
  onCommittedTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

export const useScribeRealtime = (options: UseScribeRealtimeOptions = {}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [committedTranscripts, setCommittedTranscripts] = useState<TranscriptSegment[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);

    try {
      // Get scribe token from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");

      if (error || !data?.token) {
        throw new Error(error?.message || "No se pudo obtener el token de transcripción");
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Create WebSocket connection
      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${data.token}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Scribe WebSocket connected");
        setIsConnected(true);
        setIsConnecting(false);

        // Send initial configuration
        ws.send(JSON.stringify({
          type: "configure",
          audio_format: "pcm_16000",
          sample_rate: 16000,
          commit_strategy: "vad",
        }));

        // Start audio processing
        startAudioProcessing(stream, ws);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "partial_transcript":
            const partialText = message.text || "";
            setPartialTranscript(partialText);
            options.onPartialTranscript?.(partialText);
            break;
            
          case "committed_transcript":
          case "committed_transcript_with_timestamps":
            const committedText = message.text || "";
            if (committedText.trim()) {
              const newSegment: TranscriptSegment = {
                id: `${Date.now()}-${Math.random()}`,
                text: committedText,
                timestamp: new Date(),
              };
              setCommittedTranscripts((prev) => [...prev, newSegment]);
              setPartialTranscript("");
              options.onCommittedTranscript?.(committedText);
            }
            break;
            
          case "error":
            console.error("Scribe error:", message);
            options.onError?.(message.message || "Error de transcripción");
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        options.onError?.("Error de conexión WebSocket");
      };

      ws.onclose = () => {
        console.log("Scribe WebSocket closed");
        setIsConnected(false);
        cleanup();
      };

    } catch (error) {
      console.error("Scribe connection error:", error);
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar transcripción",
      });
      options.onError?.(error instanceof Error ? error.message : "Error desconocido");
    }
  }, [isConnecting, isConnected, options, toast]);

  const startAudioProcessing = (stream: MediaStream, ws: WebSocket) => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const inputData = event.inputBuffer.getChannelData(0);
      
      // Convert float32 to int16
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Send as base64
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(int16Data.buffer))
      );
      
      ws.send(JSON.stringify({
        type: "audio",
        audio: base64Audio,
      }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanup();
    setIsConnected(false);
    setPartialTranscript("");
  }, []);

  const clearTranscripts = useCallback(() => {
    setCommittedTranscripts([]);
    setPartialTranscript("");
  }, []);

  return {
    isConnected,
    isConnecting,
    partialTranscript,
    committedTranscripts,
    connect,
    disconnect,
    clearTranscripts,
  };
};
