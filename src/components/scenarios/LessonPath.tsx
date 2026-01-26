import { cn } from "@/lib/utils";
import { Star, Lock, Check, Crown } from "lucide-react";
import type { Scenario } from "@/hooks/useScenarios";
import { Button } from "@/components/ui/button";

interface LessonPathProps {
  scenarios: Scenario[];
  onSelectScenario: (id: string) => void;
  getProgress: (id: string) => number;
}

const LessonPath = ({ scenarios, onSelectScenario, getProgress }: LessonPathProps) => {
  // Pattern for zigzag: center, right, center, left, repeat
  const getPosition = (index: number): "left" | "center" | "right" => {
    const pattern: Array<"center" | "right" | "center" | "left"> = ["center", "right", "center", "left"];
    return pattern[index % 4];
  };

  const getOffsetClass = (position: "left" | "center" | "right") => {
    switch (position) {
      case "left":
        return "-translate-x-16";
      case "right":
        return "translate-x-16";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col items-center py-8 space-y-2">
      {scenarios.map((scenario, index) => {
        const progress = getProgress(scenario.id);
        const isCompleted = progress >= 100;
        const isLocked = index > 0 && getProgress(scenarios[index - 1].id) < 100;
        const isFirst = index === 0;
        const position = getPosition(index);

        return (
          <div key={scenario.id} className="flex flex-col items-center">
            {/* Connector line (except first) */}
            {index > 0 && (
              <svg
                width="60"
                height="40"
                viewBox="0 0 60 40"
                className="text-muted-foreground/40"
              >
                <path
                  d={
                    position === "right"
                      ? "M 30 0 Q 30 20 45 40"
                      : position === "left"
                      ? "M 30 0 Q 30 20 15 40"
                      : "M 30 0 L 30 40"
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="8 6"
                />
              </svg>
            )}

            {/* Node container with offset */}
            <div className={cn("transition-transform duration-300", getOffsetClass(position))}>
              {/* Start button for first uncompleted lesson */}
              {isFirst && !isCompleted && (
                <Button
                  onClick={() => onSelectScenario(scenario.id)}
                  className="mb-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold px-6"
                >
                  EMPEZAR
                </Button>
              )}

              {/* Lesson node */}
              <button
                onClick={() => !isLocked && onSelectScenario(scenario.id)}
                disabled={isLocked}
                className={cn(
                  "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                  "shadow-lg hover:shadow-xl",
                  isLocked
                    ? "bg-muted cursor-not-allowed"
                    : isCompleted
                    ? "bg-secondary hover:scale-105"
                    : "bg-secondary hover:scale-105 ring-4 ring-secondary/30",
                  !isLocked && !isCompleted && isFirst && "ring-4 ring-secondary"
                )}
              >
                {/* Progress ring */}
                {!isLocked && !isCompleted && progress > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 80 80"
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-secondary/30"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="text-gold"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 * (1 - progress / 100)}
                    />
                  </svg>
                )}

                {/* Icon */}
                {isLocked ? (
                  <Lock className="w-8 h-8 text-muted-foreground" />
                ) : isCompleted ? (
                  <Crown className="w-8 h-8 text-secondary-foreground" />
                ) : (
                  <Star className="w-8 h-8 text-secondary-foreground" />
                )}

                {/* Completion badge */}
                {isCompleted && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gold rounded-full flex items-center justify-center shadow-md">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>

              {/* Scenario name */}
              <p
                className={cn(
                  "mt-2 text-sm font-medium text-center max-w-[100px]",
                  isLocked ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {scenario.name}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LessonPath;
