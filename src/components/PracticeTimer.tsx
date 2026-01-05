import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PracticeTimerProps {
  totalSeconds: number;
  targetSeconds?: number;
  className?: string;
}

const PracticeTimer = ({
  totalSeconds,
  targetSeconds = 7200, // 2 hours default
  className,
}: PracticeTimerProps) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = Math.min((totalSeconds / targetSeconds) * 100, 100);
  const isComplete = totalSeconds >= targetSeconds;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="w-5 h-5 text-olive-dark" />
        <span className="text-2xl font-semibold tabular-nums">
          {formatTime(totalSeconds)}
        </span>
      </div>

      <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 rounded-full",
            isComplete ? "bg-primary" : "bg-secondary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {isComplete ? (
          <span className="text-primary font-medium">
            ¡Meta alcanzada! 🎉
          </span>
        ) : (
          <>
            Meta: {formatTime(targetSeconds)} (
            {Math.round((targetSeconds - totalSeconds) / 60)} min restantes)
          </>
        )}
      </p>
    </div>
  );
};

export default PracticeTimer;
