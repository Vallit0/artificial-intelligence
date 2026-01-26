import { Flame, Crown, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsBarProps {
  streak?: number;
  xp?: number;
  lives?: number;
  className?: string;
}

const StatsBar = ({ streak = 0, xp = 0, lives = 5, className }: StatsBarProps) => {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Streak */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30">
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
          {streak}
        </span>
      </div>

      {/* XP */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Crown className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
          {xp}
        </span>
      </div>

      {/* Lives/Energy */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30">
        <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
          {lives}
        </span>
      </div>
    </div>
  );
};

export default StatsBar;
