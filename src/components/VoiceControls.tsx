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
        "flex items-center gap-4 sm:gap-8 px-4 sm:px-8 py-3 sm:py-4 bg-card border-2 border-border rounded-full shadow-[0_4px_0_0_hsl(var(--border))]",
        className
      )}
    >
      <Button
        variant={isMuted ? "destructive" : "ghost"}
        size="lg"
        onClick={onMuteToggle}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-full h-12 w-12 sm:h-auto sm:w-auto sm:px-4",
          isMuted 
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
            : "text-foreground hover:bg-accent/20"
        )}
      >
        {isMuted ? (
          <MicOff className="w-5 h-5 sm:w-5 sm:h-5" />
        ) : (
          <Mic className="w-5 h-5 sm:w-5 sm:h-5" />
        )}
        <span className="font-bold hidden sm:inline">
          {isMuted ? "Activar Mic" : "Silenciar"}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="lg"
        onClick={onEndCall}
        disabled={disabled}
        className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-12 w-12 sm:h-auto sm:w-auto sm:px-4"
      >
        <PhoneOff className="w-5 h-5" />
        <span className="font-bold hidden sm:inline">Terminar</span>
      </Button>
    </div>
  );
};

export default VoiceControls;
