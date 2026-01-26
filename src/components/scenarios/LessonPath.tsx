import { useState } from "react";
import { cn } from "@/lib/utils";
import { Star, Lock, Check, Crown, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { Scenario } from "@/hooks/useScenarios";
import ScenarioPreviewModal from "./ScenarioPreviewModal";

interface LessonPathProps {
  scenarios: Scenario[];
  onSelectScenario: (id: string) => void;
  getProgress: (id: string) => number;
  guidebookUrl?: string;
}
const LessonPath = ({
  scenarios,
  onSelectScenario,
  getProgress,
  guidebookUrl
}: LessonPathProps) => {
  const navigate = useNavigate();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNodeClick = (scenario: Scenario) => {
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
        return "-translate-x-16";
      case "right":
        return "translate-x-16";
      default:
        return "";
    }
  };

  // Determine section based on scenario index
  const getSection = (index: number): number => {
    if (index < 3) return 1;
    if (index < 6) return 2;
    return 3;
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
      default:
        return "Práctica";
    }
  };
  const handleGuidebookClick = () => {
    if (guidebookUrl) {
      window.open(guidebookUrl, '_blank');
    }
  };
  return <div className="flex flex-col items-center py-8 space-y-2">
      {scenarios.map((scenario, index) => {
      const section = getSection(index);
      const progress = getProgress(scenario.id);
      const isCompleted = progress >= 100;
      const isLocked = index > 0 && getProgress(scenarios[index - 1].id) < 100;
      const isFirst = index === 0;
      const isCurrent = !isLocked && !isCompleted;
      const position = getPosition(index);
      return <div key={scenario.id} className="flex flex-col items-center">
            {/* Section Header Banner */}
            {isNewSection(index) && <div className="w-full bg-secondary rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="text-secondary-foreground hover:bg-secondary-foreground/10 h-8 w-8" onClick={() => navigate(-1)}>
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <p className="text-xs font-medium text-secondary-foreground/80 uppercase tracking-wide">
                        SECCIÓN {section}
                      </p>
                      <h2 className="text-base font-bold text-secondary-foreground">
                        {getSectionTitle(section)}
                      </h2>
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" className="bg-secondary-foreground text-secondary font-bold hover:bg-secondary-foreground/90 border-0" onClick={handleGuidebookClick}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    GUÍA
                  </Button>
                </div>
              </div>}

            {/* Connector line (except first of each section) */}
            {index > 0 && !isNewSection(index) && <svg width="60" height="40" viewBox="0 0 60 40" className="text-muted-foreground/40">
                <path d={position === "right" ? "M 30 0 Q 30 20 45 40" : position === "left" ? "M 30 0 Q 30 20 15 40" : "M 30 0 L 30 40"} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="8 6" />
              </svg>}

            {/* Node container with offset */}
            <div className={cn("transition-transform duration-300 flex flex-col items-center", getOffsetClass(position))}>
              {/* START tooltip bubble for current lesson */}
              {isCurrent && <div className="relative mb-2 animate-bounce">
                  <div className="bg-secondary text-secondary-foreground font-bold text-sm px-4 py-2 rounded-xl shadow-lg">
                    EMPEZAR
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-secondary" />
                </div>}

              {/* Lesson node with outer ring */}
              <button onClick={() => !isLocked && handleNodeClick(scenario)} disabled={isLocked} className={cn("relative transition-all duration-300", !isLocked && "hover:scale-105 active:scale-95")}>
                {/* Outer dark ring */}
                <div className={cn("w-24 h-24 rounded-full flex items-center justify-center", isLocked ? "bg-muted/50" : "bg-muted shadow-lg")}>
                  {/* Inner colored circle */}
                  <div className={cn("w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-inner", isLocked ? "bg-muted" : isCompleted ? "bg-secondary" : "bg-secondary")}>
                    {/* Icon */}
                    {isLocked ? <Lock className="w-8 h-8 text-muted-foreground" /> : isCompleted ? <Crown className="w-8 h-8 text-secondary-foreground" /> : <Star className="w-8 h-8 text-secondary-foreground" />}
                  </div>
                </div>

                {/* Progress ring overlay */}
                {!isLocked && !isCompleted && progress > 0 && <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="4" className="text-gold" strokeLinecap="round" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)} />
                  </svg>}

                {/* Completion badge */}
                {isCompleted && <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gold rounded-full flex items-center justify-center shadow-md border-2 border-sidebar-background">
                    <Check className="w-5 h-5 text-primary" />
                  </div>}
              </button>

              {/* Scenario name */}
              <p className={cn("mt-3 text-sm font-medium text-center max-w-[120px] text-indigo-700", isLocked ? "text-muted-foreground" : "text-sidebar-foreground")}>
                {scenario.name}
              </p>
            </div>
          </div>;
    })}

      {/* Scenario Preview Modal */}
      <ScenarioPreviewModal
        scenario={selectedScenario}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onStartPractice={handleStartPractice}
      />
    </div>;
};
export default LessonPath;