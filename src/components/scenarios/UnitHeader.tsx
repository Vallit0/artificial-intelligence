import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";

interface UnitHeaderProps {
  title: string;
  description?: string;
  isExpanded?: boolean;
  progress?: number;
  onToggle?: () => void;
  className?: string;
}

const UnitHeader = ({
  title,
  description,
  isExpanded = true,
  progress = 0,
  onToggle,
  className,
}: UnitHeaderProps) => {
  const isComplete = progress >= 100;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full p-4 rounded-2xl transition-all duration-300",
        "flex items-center justify-between gap-4",
        "bg-gradient-to-r from-primary/10 to-primary/5",
        "hover:from-primary/15 hover:to-primary/10",
        "border border-primary/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Unit icon */}
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isComplete
              ? "bg-secondary text-secondary-foreground"
              : "bg-primary/20 text-primary"
          )}
        >
          <Trophy className="w-6 h-6" />
        </div>

        <div className="text-left">
          <h3 className="font-bold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Progress indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isComplete ? "bg-secondary" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Expand/collapse icon */}
        {onToggle && (
          isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )
        )}
      </div>
    </button>
  );
};

export default UnitHeader;
