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
      {/* Outer glow ring */}
      <div
        className={cn(
          "absolute rounded-full bg-accent/20 animate-breathe",
          size === "sm" ? "w-32 h-32" : size === "md" ? "w-52 h-52" : "w-72 h-72"
        )}
      />
      
      {/* Middle pulse ring */}
      <div
        className={cn(
          "absolute rounded-full bg-accent/30 animate-pulse-gentle",
          size === "sm" ? "w-28 h-28" : size === "md" ? "w-46 h-46" : "w-64 h-64"
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
          size === "sm" ? "w-16 h-16" : size === "md" ? "w-28 h-28" : "w-40 h-40"
        )}
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%) translate(-10%, -10%)" }}
      />
    </div>
  );
};

export default VoiceOrb;
