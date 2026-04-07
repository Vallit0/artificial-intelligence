import { Mic, MicOff, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isMuted: boolean;
  onMuteToggle: () => void;
  onEndCall: () => void;
  disabled?: boolean;
  className?: string;
}

const VoiceControls = ({
  isMuted,
  onMuteToggle,
  onEndCall,
  disabled = false,
  className,
}: VoiceControlsProps) => {
  return (
    <div className={cn("flex items-center gap-8", className)}>
      {/* Mute button */}
      <button
        onClick={onMuteToggle}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 active:scale-90",
          isMuted
            ? "bg-muted-foreground/20 text-foreground ring-2 ring-foreground/30"
            : "bg-muted text-foreground hover:bg-muted-foreground/15"
        )}
      >
        {isMuted ? (
          <MicOff className="w-7 h-7" />
        ) : (
          <Mic className="w-7 h-7" />
        )}
      </button>

      {/* End call button */}
      <button
        onClick={onEndCall}
        disabled={disabled}
        className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-90 transition-all duration-200 shadow-[0_4px_16px_rgba(239,68,68,0.4)]"
      >
        <Phone className="w-7 h-7 rotate-[135deg]" />
      </button>
    </div>
  );
};

export default VoiceControls;
