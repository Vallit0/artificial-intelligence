import { cn } from "@/lib/utils";
import { Star, Lock, Check, Crown } from "lucide-react";
import type { Scenario } from "@/hooks/useScenarios";

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
        const isCurrent = !isLocked && !isCompleted;
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
            <div className={cn("transition-transform duration-300 flex flex-col items-center", getOffsetClass(position))}>
              {/* START tooltip bubble for first/current lesson */}
              {isFirst && isCurrent && (
                <div className="relative mb-2">
                  <div className="bg-secondary text-secondary-foreground font-bold text-sm px-4 py-2 rounded-xl shadow-lg">
                    EMPEZAR
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-secondary" />
                </div>
              )}

              {/* Lesson node with outer ring */}
              <button
                onClick={() => !isLocked && onSelectScenario(scenario.id)}
                disabled={isLocked}
                className={cn(
                  "relative transition-all duration-300",
                  !isLocked && "hover:scale-105 active:scale-95"
                )}
              >
                {/* Outer dark ring */}
                <div
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center",
                    isLocked
                      ? "bg-muted/50"
                      : "bg-muted shadow-lg"
                  )}
                >
                  {/* Inner colored circle */}
                  <div
                    className={cn(
                      "w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-inner",
                      isLocked
                        ? "bg-muted"
                        : isCompleted
                        ? "bg-secondary"
                        : "bg-secondary"
                    )}
                  >
                    {/* Icon */}
                    {isLocked ? (
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    ) : isCompleted ? (
                      <Crown className="w-8 h-8 text-secondary-foreground" />
                    ) : (
                      <Star className="w-8 h-8 text-secondary-foreground" />
                    )}
                  </div>
                </div>

                {/* Progress ring overlay */}
                {!isLocked && !isCompleted && progress > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 96 96"
                  >
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-gold"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 44}
                      strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)}
                    />
                  </svg>
                )}

                {/* Completion badge */}
                {isCompleted && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gold rounded-full flex items-center justify-center shadow-md border-2 border-sidebar-background">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                )}
              </button>

              {/* Scenario name */}
              <p
                className={cn(
                  "mt-3 text-sm font-medium text-center max-w-[120px]",
                  isLocked ? "text-muted-foreground" : "text-sidebar-foreground"
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
