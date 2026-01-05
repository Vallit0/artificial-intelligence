import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div
      className={cn(
        "flex items-center gap-8 px-8 py-4 bg-accent/50 rounded-full backdrop-blur-sm",
        className
      )}
    >
      <Button
        variant="ghost"
        size="lg"
        onClick={onMuteToggle}
        disabled={disabled}
        className="flex items-center gap-2 text-olive-dark hover:text-foreground hover:bg-accent"
      >
        {isMuted ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
        <span className="font-medium">{isMuted ? "Activar" : "Silenciar"}</span>
      </Button>

      <Button
        variant="ghost"
        size="lg"
        onClick={onEndCall}
        disabled={disabled}
        className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <PhoneOff className="w-5 h-5" />
        <span className="font-medium">Terminar</span>
      </Button>
    </div>
  );
};

export default VoiceControls;
