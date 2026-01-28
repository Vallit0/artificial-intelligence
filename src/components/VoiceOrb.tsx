import { cn } from "@/lib/utils";

interface VoiceOrbProps {
  isSpeaking: boolean;
  isListening: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VoiceOrb = ({ isSpeaking, isListening, size = "lg", className }: VoiceOrbProps) => {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32 sm:w-40 sm:h-40",
    lg: "w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56",
  };

  const outerGlowClasses = {
    sm: "w-32 h-32",
    md: "w-40 h-40 sm:w-52 sm:h-52",
    lg: "w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72",
  };

  const middlePulseClasses = {
    sm: "w-28 h-28",
    md: "w-36 h-36 sm:w-46 sm:h-46",
    lg: "w-46 h-46 sm:w-54 sm:h-54 md:w-64 md:h-64",
  };

  const innerHighlightClasses = {
    sm: "w-16 h-16",
    md: "w-20 h-20 sm:w-28 sm:h-28",
    lg: "w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40",
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow ring */}
      <div
        className={cn(
          "absolute rounded-full bg-accent/20 animate-breathe",
          outerGlowClasses[size]
        )}
      />
      
      {/* Middle pulse ring */}
      <div
        className={cn(
          "absolute rounded-full bg-accent/30 animate-pulse-gentle",
          middlePulseClasses[size]
        )}
        style={{ animationDelay: "0.5s" }}
      />

      {/* Main orb */}
      <div
        className={cn(
          "rounded-full bg-accent transition-all duration-500 shadow-lg",
          sizeClasses[size],
          isSpeaking && "animate-wave",
          isListening && !isSpeaking && "animate-breathe"
        )}
      />

      {/* Inner highlight */}
      <div
        className={cn(
          "absolute rounded-full bg-gradient-to-br from-sage/40 to-transparent pointer-events-none",
          innerHighlightClasses[size]
        )}
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%) translate(-10%, -10%)" }}
      />
    </div>
  );
};

export default VoiceOrb;
