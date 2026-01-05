import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const encodeAudioForAPI = useCallback((float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }, []);

  const createWavFromPCM = useCallback((pcmData: Uint8Array): Uint8Array => {
    const int16Data = new Int16Array(pcmData.length / 2);
    for (let i = 0; i < pcmData.length; i += 2) {
      int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
    }

    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + int16Data.byteLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, int16Data.byteLength, true);

    const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
    wavArray.set(new Uint8Array(wavHeader), 0);
    wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);
    return wavArray;
  }, []);

  const playNextAudio = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      options.onSpeakingChange?.(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    options.onSpeakingChange?.(true);

    const audioData = audioQueueRef.current.shift()!;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const wavData = createWavFromPCM(audioData);
      const arrayBuffer = wavData.buffer.slice(0) as ArrayBuffer;
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => playNextAudio();
      source.start(0);
    } catch (error) {
      console.error("Error playing audio:", error);
      playNextAudio();
    }
  }, [createWavFromPCM, options]);

  const addToAudioQueue = useCallback(
    (audioData: Uint8Array) => {
      audioQueueRef.current.push(audioData);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    },
    [playNextAudio]
  );

  const connect = useCallback(async () => {
    setIsConnecting(true);

    try {
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

      const { data, error } = await supabase.functions.invoke("realtime-session");
      if (error || !data?.client_secret?.value) {
        throw new Error("No se pudo obtener el token de sesión");
      }

      const ephemeralKey = data.client_secret.value;
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`
      );

      ws.onopen = () => {
        console.log("WebSocket connected, authenticating...");
        // Send authentication
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `Eres un cliente potencial que está considerando contratar los servicios funerarios de Capillas Señoriales. Tu nombre es María González.

Comportamiento:
- Actúa como alguien que está explorando opciones para un plan funerario
- Haz preguntas sobre precios, servicios, planes de pago
- A veces muestra objeciones comunes: "es muy caro", "necesito pensarlo", "voy a comparar con otros"
- Sé cortés pero firme cuando tengas dudas
- Responde en español naturalmente

Objetivo: Ayudar al asesor a practicar técnicas de venta efectivas y manejo de objeciones.`,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000,
            },
            temperature: 0.8,
          },
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received:", data.type);

        if (data.type === "session.created" || data.type === "session.updated") {
          console.log("Session ready");
          setIsConnected(true);
          setIsConnecting(false);

          // Start audio recording
          const audioCtx = new AudioContext({ sampleRate: 24000 });
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          sourceRef.current = source;
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (!isMuted && ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const encoded = encodeAudioForAPI(new Float32Array(inputData));
              ws.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: encoded,
              }));
            }
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);

          // Start timer
          timerRef.current = setInterval(() => {
            setSessionTime((prev) => prev + 1);
          }, 1000);

          toast({
            title: "Conectado",
            description: "Puedes comenzar a practicar",
          });
        }

        if (data.type === "response.audio.delta" && data.delta) {
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          addToAudioQueue(bytes);
        }

        if (data.type === "response.audio_transcript.done") {
          options.onTranscript?.(data.transcript || "", false);
        }

        if (data.type === "conversation.item.input_audio_transcription.completed") {
          options.onTranscript?.(data.transcript || "", true);
        }

        if (data.type === "error") {
          console.error("API error:", data.error);
          toast({
            variant: "destructive",
            title: "Error",
            description: data.error?.message || "Error en la conexión",
          });
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
        toast({
          variant: "destructive",
          title: "Error de conexión",
          description: "No se pudo conectar con el servicio de voz",
        });
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        setIsConnecting(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Connection error:", error);
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar",
      });
    }
  }, [encodeAudioForAPI, addToAudioQueue, isMuted, toast, options]);

  const disconnect = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setIsSpeaking(false);

    toast({
      title: "Sesión terminada",
      description: `Tiempo de práctica: ${Math.floor(sessionTime / 60)} minutos`,
    });
  }, [sessionTime, toast]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
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
