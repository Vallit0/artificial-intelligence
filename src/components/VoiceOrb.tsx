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
    md: "w-40 h-40",
    lg: "w-56 h-56",
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow when speaking */}
      {isSpeaking && (
        <div
          className={cn(
            "absolute rounded-full bg-accent/30 animate-wave",
            size === "sm" ? "w-32 h-32" : size === "md" ? "w-52 h-52" : "w-72 h-72"
          )}
        />
      )}
      
      {/* Secondary pulse ring */}
      {(isSpeaking || isListening) && (
        <div
          className={cn(
            "absolute rounded-full bg-accent/20 animate-pulse-gentle",
            size === "sm" ? "w-28 h-28" : size === "md" ? "w-48 h-48" : "w-64 h-64"
          )}
          style={{ animationDelay: "0.5s" }}
        />
      )}

      {/* Main orb */}
      <div
        className={cn(
          "rounded-full bg-accent transition-all duration-300 shadow-lg",
          sizeClasses[size],
          isSpeaking && "animate-wave",
          isListening && "animate-pulse-gentle"
        )}
      />

      {/* Inner highlight */}
      <div
        className={cn(
          "absolute rounded-full bg-gradient-to-br from-sage/50 to-transparent",
          size === "sm" ? "w-20 h-20" : size === "md" ? "w-32 h-32" : "w-44 h-44"
        )}
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
};

export default VoiceOrb;
