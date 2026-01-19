import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceControls from "@/components/VoiceControls";
import LogoMorph from "@/components/LogoMorph";
import FeedbackScreen from "@/components/FeedbackScreen";
import PracticeTimer from "@/components/PracticeTimer";
import UserMenu from "@/components/UserMenu";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { supabase } from "@/integrations/supabase/client";
import type { Scenario } from "@/hooks/useScenarios";

type SessionState = "idle" | "morphing" | "active" | "feedback";

const Practice = () => {
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const sessionDurationRef = useRef<number>(0);
  const { savePracticeSession } = usePracticeSessions();

  // Fetch scenario details
  useEffect(() => {
    if (scenarioId) {
      supabase
        .from("scenarios")
        .select("*")
        .eq("id", scenarioId)
        .single()
        .then(({ data }) => {
          if (data) setScenario(data);
        });
    }
  }, [scenarioId]);

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
  } = useElevenLabsConversation({
    scenarioId,
    onTranscript: handleTranscript,
  });

  // Keep track of session duration
  sessionDurationRef.current = sessionTime;

  // Transition to active when connected
  useEffect(() => {
    if (isConnected && sessionState === "morphing") {
      setSessionState("active");
    }
  }, [isConnected, sessionState]);

  const handleStart = async () => {
    setSessionState("morphing");
    // Start connection - will transition to active when connected
    connect();
  };

  const handleEndCall = () => {
    disconnect();
    setSessionState("feedback");
  };

  const handleFeedbackSubmit = async (rating: number) => {
    // Save practice session to database with scenario
    await savePracticeSession(sessionDurationRef.current, rating, scenarioId ?? undefined);
    console.log("Session saved:", sessionDurationRef.current, "seconds, rating:", rating, "scenario:", scenarioId);
    
    // Reset to idle state
    setSessionState("idle");
  };

  if (sessionState === "feedback") {
    return (
      <FeedbackScreen
        agentName={scenario?.voice_type === "male" ? "Cliente" : "María"}
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

      {/* Show scenario info when idle */}
      {sessionState === "idle" && scenario && (
        <div className="absolute top-6 left-6 max-w-xs">
          <p className="text-sm font-medium text-foreground">{scenario.name}</p>
          <p className="text-xs text-muted-foreground">Objeción: "{scenario.objection}"</p>
        </div>
      )}

      {(sessionState === "idle" || sessionState === "morphing") && (
        <LogoMorph
          onClick={handleStart}
          isConnecting={isConnecting}
          isMorphing={sessionState === "morphing"}
        />
      )}

      {sessionState === "active" && (
        <div className="flex flex-col items-center gap-16 animate-fade-in">
          {scenario && (
            <p className="text-sm text-muted-foreground">
              Practicando: "{scenario.objection}"
            </p>
          )}
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
