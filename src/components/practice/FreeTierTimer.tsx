import { useEffect, useState } from "react";
import { Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FreeTierTimerProps {
  maxSeconds: number;
  currentSeconds: number;
  onTimeUp: () => void;
}

export const FreeTierTimer = ({
  maxSeconds,
  currentSeconds,
  onTimeUp,
}: FreeTierTimerProps) => {
  const navigate = useNavigate();
  const [hasTriggered, setHasTriggered] = useState(false);
  
  const remainingSeconds = Math.max(0, maxSeconds - currentSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const percentage = (remainingSeconds / maxSeconds) * 100;
  
  const isLow = remainingSeconds <= 60;
  const isCritical = remainingSeconds <= 30;

  useEffect(() => {
    if (remainingSeconds <= 0 && !hasTriggered) {
      setHasTriggered(true);
      onTimeUp();
    }
  }, [remainingSeconds, hasTriggered, onTimeUp]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full border transition-all",
        isCritical
          ? "bg-destructive/10 border-destructive/50 animate-pulse"
          : isLow
          ? "bg-orange-500/10 border-orange-500/50"
          : "bg-muted/50 border-border"
      )}
    >
      <Clock
        className={cn(
          "h-4 w-4",
          isCritical
            ? "text-destructive"
            : isLow
            ? "text-orange-500"
            : "text-muted-foreground"
        )}
      />
      <div className="flex flex-col">
        <span
          className={cn(
            "text-sm font-mono font-medium",
            isCritical
              ? "text-destructive"
              : isLow
              ? "text-orange-500"
              : "text-foreground"
          )}
        >
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
        <span className="text-xs text-muted-foreground">restantes</span>
      </div>
      
      {isLow && (
        <Button
          size="sm"
          variant="outline"
          className="ml-2 gap-1.5 text-xs h-7"
          onClick={() => navigate("/auth?mode=signup")}
        >
          <Crown className="h-3 w-3" />
          Más tiempo
        </Button>
      )}
    </div>
  );
};
