import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

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

// Helper to convert ArrayBuffer to base64 without stack overflow
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
};

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
  const isCleaningUpRef = useRef(false);

  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    console.log("Cleaning up Scribe resources...");

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {
        console.log("Processor already disconnected");
      }
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.log("AudioContext already closed");
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    isCleaningUpRef.current = false;
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    isCleaningUpRef.current = false;

    try {
      // Get scribe token from API
      const data = await api.post<{ token: string }>("/api/elevenlabs/scribe-token");

      if (!data?.token) {
        throw new Error("No se pudo obtener el token de transcripción");
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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

        ws.send(JSON.stringify({
          type: "configure",
          audio_format: "pcm_16000",
          sample_rate: 16000,
          commit_strategy: "vad",
          language_code: "es",
        }));

        startAudioProcessing(stream, ws);
      };

      ws.onmessage = (event) => {
        try {
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

            case "session_started":
              console.log("Scribe session started");
              break;

            case "error":
              console.error("Scribe error:", message);
              options.onError?.(message.message || "Error de transcripción");
              break;
          }
        } catch (e) {
          console.error("Error parsing Scribe message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("Scribe WebSocket error:", error);
        options.onError?.("Error de conexión WebSocket");
      };

      ws.onclose = (event) => {
        console.log("Scribe WebSocket closed", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        cleanup();
      };

    } catch (error) {
      console.error("Scribe connection error:", error);
      setIsConnecting(false);
      setIsConnected(false);
      cleanup();
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar transcripción",
      });
      options.onError?.(error instanceof Error ? error.message : "Error desconocido");
    }
  }, [isConnecting, isConnected, options, toast, cleanup]);

  const startAudioProcessing = (stream: MediaStream, ws: WebSocket) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);

        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        try {
          const base64Audio = arrayBufferToBase64(int16Data.buffer);
          ws.send(JSON.stringify({
            type: "audio",
            audio: base64Audio,
          }));
        } catch (e) {
          console.error("Error sending audio:", e);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      console.error("Error starting audio processing:", error);
      options.onError?.("Error al procesar audio");
    }
  };

  const disconnect = useCallback(() => {
    console.log("Disconnecting Scribe...");

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, "User disconnected");
        }
      } catch (e) {
        console.log("Error closing WebSocket:", e);
      }
      wsRef.current = null;
    }

    cleanup();
    setIsConnected(false);
    setIsConnecting(false);
    setPartialTranscript("");
  }, [cleanup]);

  const clearTranscripts = useCallback(() => {
    setCommittedTranscripts([]);
    setPartialTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
