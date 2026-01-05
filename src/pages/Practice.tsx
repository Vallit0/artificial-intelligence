import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import PracticeTimer from "@/components/PracticeTimer";
import { useRealtimeAudio } from "@/hooks/useRealtimeAudio";
import { Mic } from "lucide-react";

const Practice = () => {
  const [transcripts, setTranscripts] = useState<
    { text: string; isUser: boolean }[]
  >([]);

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    setTranscripts((prev) => [...prev, { text, isUser }]);
  }, []);

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    sessionTime,
    connect,
    disconnect,
    toggleMute,
  } = useRealtimeAudio({
    onTranscript: handleTranscript,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-8 px-6 flex flex-col items-center justify-center min-h-screen">
        {!isConnected ? (
          // Pre-connection state
          <div className="text-center space-y-8 animate-fade-in">
            <div className="bg-accent/50 rounded-3xl p-12 max-w-lg mx-auto">
              <h1 className="text-2xl font-semibold text-olive-dark mb-4">
                Práctica de Ventas
              </h1>
              <p className="text-muted-foreground mb-8">
                Para hablar con el cliente virtual, por favor permite el acceso
                a tu micrófono.
              </p>

              <Button
                size="lg"
                onClick={connect}
                disabled={isConnecting}
                className="rounded-full px-8"
              >
                <Mic className="w-5 h-5 mr-2" />
                {isConnecting ? "Conectando..." : "Iniciar Práctica"}
              </Button>
            </div>

            <PracticeTimer totalSeconds={0} />
          </div>
        ) : (
          // Active session
          <div className="flex flex-col items-center gap-8 animate-fade-in">
            {/* Agent name and timer */}
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-olive-dark">
                María{" "}
                <span className="tabular-nums">
                  {String(Math.floor(sessionTime / 60)).padStart(2, "0")}:
                  {String(sessionTime % 60).padStart(2, "0")}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">Cliente virtual</p>
            </div>

            {/* Voice Orb */}
            <div className="py-12">
              <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} />
            </div>

            {/* Controls */}
            <VoiceControls
              isMuted={isMuted}
              onMuteToggle={toggleMute}
              onEndCall={disconnect}
            />

            {/* Timer progress */}
            <PracticeTimer totalSeconds={sessionTime} className="mt-8" />

            {/* Transcripts */}
            {transcripts.length > 0 && (
              <div className="w-full max-w-md mt-8 space-y-2 max-h-40 overflow-y-auto">
                {transcripts.slice(-5).map((t, i) => (
                  <p
                    key={i}
                    className={`text-sm p-2 rounded-lg ${
                      t.isUser
                        ? "bg-primary/10 text-foreground ml-8"
                        : "bg-accent text-foreground mr-8"
                    }`}
                  >
                    {t.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Practice;
