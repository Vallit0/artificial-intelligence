import { useState } from "react";
import { cn } from "@/lib/utils";
import { Star, Lock, Check, Crown, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { ScenarioWithProgress } from "@/hooks/useScenarios";
import ScenarioPreviewModal from "./ScenarioPreviewModal";

interface LessonPathProps {
  scenarios: ScenarioWithProgress[];
  onSelectScenario: (id: string) => void;
  guidebookUrl?: string;
}

const LessonPath = ({
  scenarios,
  onSelectScenario,
  guidebookUrl
}: LessonPathProps) => {
  const navigate = useNavigate();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioWithProgress | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNodeClick = (scenario: ScenarioWithProgress) => {
    setSelectedScenario(scenario);
    setIsModalOpen(true);
  };

  const handleStartPractice = (scenarioId: string) => {
    setIsModalOpen(false);
    onSelectScenario(scenarioId);
  };

  // Pattern for zigzag: center, right, center, left, repeat
  const getPosition = (index: number): "left" | "center" | "right" => {
    const pattern: Array<"center" | "right" | "center" | "left"> = ["center", "right", "center", "left"];
    return pattern[index % 4];
  };

  const getOffsetClass = (position: "left" | "center" | "right") => {
    switch (position) {
      case "left":
        return "-translate-x-8 sm:-translate-x-16";
      case "right":
        return "translate-x-8 sm:translate-x-16";
      default:
        return "";
    }
  };

  // Determine section based on scenario index
  const getSection = (index: number): number => {
    if (index < 3) return 1;
    if (index < 6) return 2;
    if (index < 9) return 3;
    return 4; // Prospección Final
  };

  // Check if this is the first item of a new section
  const isNewSection = (index: number): boolean => {
    if (index === 0) return true;
    return getSection(index) !== getSection(index - 1);
  };

  // Get section title
  const getSectionTitle = (section: number): string => {
    switch (section) {
      case 1:
        return "Primeras Objeciones";
      case 2:
        return "Objeciones Intermedias";
      case 3:
        return "Objeciones Avanzadas";
      case 4:
        return "Prospección Final";
      default:
        return "Práctica";
    }
  };

  const handleGuidebookClick = () => {
    if (guidebookUrl) {
      window.open(guidebookUrl, '_blank');
    }
  };

  // Helper to get scenario state
  const getScenarioState = (scenario: ScenarioWithProgress, index: number) => {
    const progress = scenario.progress;
    
    // If no progress data, check by index (first is unlocked, rest locked)
    if (!progress) {
      return {
        isCompleted: false,
        isLocked: index > 0,
        isCurrent: index === 0,
        bestScore: null,
      };
    }

    const isCompleted = progress.is_completed;
    const isUnlocked = progress.is_unlocked;
    
    // Find the first unlocked but not completed scenario (current)
    const isCurrent = isUnlocked && !isCompleted;
    
    return {
      isCompleted,
      isLocked: !isUnlocked,
      isCurrent,
      bestScore: progress.best_score,
    };
  };

  return (
    <div className="flex flex-col items-center py-4 sm:py-8 space-y-1 sm:space-y-2 pb-24 lg:pb-8">
      {scenarios.map((scenario, index) => {
        const section = getSection(index);
        const { isCompleted, isLocked, isCurrent, bestScore } = getScenarioState(scenario, index);
        const position = getPosition(index);
        
        // Calculate progress percentage from best score
        const progressPercent = bestScore ? Math.min(100, bestScore) : 0;

        return (
          <div key={scenario.id} className="flex flex-col items-center">
            {/* Section Header Banner */}
            {isNewSection(index) && (
              <div className="w-full bg-secondary rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-secondary-foreground hover:bg-secondary-foreground/10 h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                      onClick={() => navigate(-1)}
                    >
                      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs font-medium text-secondary-foreground/80 uppercase tracking-wide">
                        SECCIÓN {section}
                      </p>
                      <h2 className="text-sm sm:text-base font-bold text-secondary-foreground truncate">
                        {getSectionTitle(section)}
                      </h2>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-secondary-foreground text-secondary font-bold hover:bg-secondary-foreground/90 border-0 text-xs sm:text-sm px-2 sm:px-3 h-8 shrink-0"
                    onClick={handleGuidebookClick}
                  >
                    <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">GUÍA</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Connector line (except first of each section) */}
            {index > 0 && !isNewSection(index) && (
              <svg
                width="40"
                height="28"
                viewBox="0 0 60 40"
                className="text-muted-foreground/40 sm:w-[60px] sm:h-[40px]"
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
            <div
              className={cn(
                "transition-transform duration-300 flex flex-col items-center",
                getOffsetClass(position)
              )}
            >
              {/* START tooltip bubble for current lesson */}
              {isCurrent && (
                <div className="relative mb-1 sm:mb-2 animate-bounce">
                  <div className="bg-secondary text-secondary-foreground font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-lg">
                    EMPEZAR
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 sm:-bottom-2 w-0 h-0 border-l-[6px] sm:border-l-[8px] border-l-transparent border-r-[6px] sm:border-r-[8px] border-r-transparent border-t-[6px] sm:border-t-[8px] border-t-secondary" />
                </div>
              )}

              {/* Lesson node with outer ring */}
              <button
                onClick={() => !isLocked && handleNodeClick(scenario)}
                disabled={isLocked}
                className={cn(
                  "relative transition-all duration-300",
                  isLocked && "opacity-60",
                  !isLocked && "hover:scale-105 active:scale-95"
                )}
              >
                {/* Outer dark ring */}
                <div
                  className={cn(
                    "w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center",
                    isLocked ? "bg-muted/50" : "bg-muted shadow-lg"
                  )}
                >
                  {/* Inner colored circle */}
                  <div
                    className={cn(
                      "w-12 h-12 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center shadow-inner",
                      isLocked
                        ? "bg-muted"
                        : isCompleted
                        ? "bg-secondary"
                        : "bg-secondary"
                    )}
                  >
                    {/* Icon */}
                    {isLocked ? (
                      <Lock className="w-5 h-5 sm:w-8 sm:h-8 text-muted-foreground" />
                    ) : isCompleted ? (
                      <Crown className="w-5 h-5 sm:w-8 sm:h-8 text-secondary-foreground" />
                    ) : (
                      <Star className="w-5 h-5 sm:w-8 sm:h-8 text-secondary-foreground" />
                    )}
                  </div>
                </div>

                {/* Progress ring overlay */}
                {!isLocked && !isCompleted && progressPercent > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 64 64 sm:0 0 96 96"
                  >
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-gold sm:hidden"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - progressPercent / 100)}
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-gold hidden sm:block"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 44}
                      strokeDashoffset={2 * Math.PI * 44 * (1 - progressPercent / 100)}
                    />
                  </svg>
                )}

                {/* Completion badge with score */}
                {isCompleted && (
                  <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-6 h-6 sm:w-8 sm:h-8 bg-gold rounded-full flex items-center justify-center shadow-md border-2 border-sidebar-background">
                    <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-primary" />
                  </div>
                )}

                {/* Best score badge for non-completed but attempted */}
                {!isCompleted && bestScore !== null && bestScore > 0 && (
                  <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-6 h-6 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md border-2 border-background text-[10px] sm:text-xs font-bold">
                    {bestScore}
                  </div>
                )}
              </button>

              {/* Scenario name */}
              <p
                className={cn(
                  "mt-2 sm:mt-3 text-xs sm:text-sm font-medium text-center max-w-[90px] sm:max-w-[120px] leading-tight",
                  isLocked ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {scenario.name}
              </p>
            </div>
          </div>
        );
      })}

      {/* Scenario Preview Modal */}
      <ScenarioPreviewModal
        scenario={selectedScenario}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onStartPractice={handleStartPractice}
      />
    </div>
  );
};

export default LessonPath;
