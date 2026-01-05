import { useState, useCallback } from "react";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import StartPracticeButton from "@/components/StartPracticeButton";
import FeedbackScreen from "@/components/FeedbackScreen";
import { useRealtimeAudio } from "@/hooks/useRealtimeAudio";
import { useNavigate } from "react-router-dom";

type SessionState = "idle" | "morphing" | "active" | "feedback";

const Practice = () => {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>("idle");

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    console.log(isUser ? "User:" : "Agent:", text);
  }, []);

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    connect,
    disconnect,
    toggleMute,
  } = useRealtimeAudio({
    onTranscript: handleTranscript,
  });

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

  const handleFeedbackSubmit = (rating: number) => {
    console.log("Rating submitted:", rating);
    navigate("/");
  };

  if (sessionState === "feedback") {
    return <FeedbackScreen agentName="María" onSubmit={handleFeedbackSubmit} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      {sessionState === "idle" && (
        <StartPracticeButton
          onClick={handleStart}
          isConnecting={isConnecting}
          isMorphing={false}
        />
      )}

      {sessionState === "morphing" && (
        <StartPracticeButton
          onClick={() => {}}
          isConnecting={true}
          isMorphing={true}
        />
      )}

      {sessionState === "active" && (
        <div className="flex flex-col items-center gap-16 animate-fade-in">
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
