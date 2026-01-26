import { cn } from "@/lib/utils";
import { Phone, MessageSquare, Clock, Target, Users, Briefcase } from "lucide-react";
import type { Scenario } from "@/hooks/useScenarios";

interface ScenarioNodeProps {
  scenario: Scenario;
  index: number;
  isCompleted?: boolean;
  isLocked?: boolean;
  progress?: number;
  onClick: () => void;
}

const scenarioIcons: Record<string, React.ElementType> = {
  easy: Phone,
  medium: MessageSquare,
  hard: Target,
};

const difficultyColors: Record<string, { bg: string; ring: string; icon: string }> = {
  easy: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    ring: "stroke-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    ring: "stroke-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
  },
  hard: {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    ring: "stroke-rose-500",
    icon: "text-rose-600 dark:text-rose-400",
  },
};

const ScenarioNode = ({
  scenario,
  index,
  isCompleted = false,
  isLocked = false,
  progress = 0,
  onClick,
}: ScenarioNodeProps) => {
  const Icon = scenarioIcons[scenario.difficulty] || Phone;
  const colors = difficultyColors[scenario.difficulty] || difficultyColors.easy;
  
  // Calculate stroke dash for progress ring
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={isLocked}
        className={cn(
          "relative group transition-all duration-300",
          isLocked && "opacity-50 cursor-not-allowed",
          !isLocked && "hover:scale-105 active:scale-95"
        )}
      >
        {/* Progress ring */}
        <svg
          className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90"
          viewBox="0 0 120 120"
        >
          {/* Background ring */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress ring */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(colors.ring, "transition-all duration-500")}
            strokeDasharray={circumference}
            strokeDashoffset={isCompleted ? 0 : strokeDashoffset}
          />
        </svg>

        {/* Main circle */}
        <div
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center",
            "shadow-lg transition-all duration-300",
            colors.bg,
            !isLocked && "group-hover:shadow-xl"
          )}
        >
          <Icon className={cn("w-8 h-8", colors.icon)} />
        </div>

        {/* Crown/badge for completed */}
        {isCompleted && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-secondary rounded-full flex items-center justify-center shadow-md animate-bounce-slow">
            <span className="text-xs">👑</span>
          </div>
        )}

        {/* Level indicator */}
        {!isCompleted && progress > 0 && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-md">
            {Math.round(progress)}%
          </div>
        )}
      </button>

      {/* Scenario name */}
      <span
        className={cn(
          "text-sm font-medium text-center max-w-[100px] leading-tight",
          isLocked ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {scenario.name}
      </span>
    </div>
  );
};

export default ScenarioNode;
