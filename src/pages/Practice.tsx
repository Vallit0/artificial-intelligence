import { useState, useCallback, useRef } from "react";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LogoMorph from "@/components/LogoMorph";
import FeedbackScreen from "@/components/FeedbackScreen";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import { useRealtimeAudio } from "@/hooks/useRealtimeAudio";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";

type SessionState = "idle" | "morphing" | "active" | "feedback";

const Practice = () => {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const sessionDurationRef = useRef<number>(0);
  const { savePracticeSession } = usePracticeSessions();

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    console.log(isUser ? "User:" : "Agent:", text);
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

  // Keep track of session duration
  sessionDurationRef.current = sessionTime;

  const handleStart = async () => {
    setSessionState("morphing");
    
    // Start connection during morph animation
    connect();
    
    // Transition to active after morph completes
    setTimeout(() => {
      setSessionState("active");
    }, 1500);
  };

  const handleEndCall = () => {
    disconnect();
    setSessionState("feedback");
  };

  const handleFeedbackSubmit = async (rating: number) => {
    // Save practice session to database
    await savePracticeSession(sessionDurationRef.current, rating);
    console.log("Session saved:", sessionDurationRef.current, "seconds, rating:", rating);
    
    // Reset to idle state
    setSessionState("idle");
  };

  if (sessionState === "feedback") {
    return (
      <FeedbackScreen
        agentName="María"
        onSubmit={handleFeedbackSubmit}
        sessionDuration={sessionDurationRef.current}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
      {/* User menu - always visible */}
      <div className="absolute top-6 right-6">
        <UserMenu />
      </div>

      {(sessionState === "idle" || sessionState === "morphing") && (
        <LogoMorph
          onClick={handleStart}
          isConnecting={isConnecting}
          isMorphing={sessionState === "morphing"}
        />
      )}

      {sessionState === "active" && (
        <div className="flex flex-col items-center gap-16 animate-fade-in">
          <PracticeTimer totalSeconds={sessionTime} className="mb-4" />
          
          <VoiceOrb isSpeaking={isSpeaking} isListening={!isMuted} />

          <VoiceControls
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            onEndCall={handleEndCall}
          />
        </div>
      )}
    </div>
  );
};

export default Practice;
