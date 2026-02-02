import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProspectingScenario } from "./ProspectingScenarioCard";

interface ProspectingPreviewModalProps {
  scenario: ProspectingScenario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartPractice: (scenarioId: number) => void;
}

const ProspectingPreviewModal = ({
  scenario,
  open,
  onOpenChange,
  onStartPractice,
}: ProspectingPreviewModalProps) => {
  if (!scenario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg p-0 overflow-hidden border-border/50 bg-card max-h-[90vh] overflow-y-auto">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-secondary to-secondary/80 p-4 sm:p-6 text-secondary-foreground">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2 animate-fade-in min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="text-xs sm:text-sm font-medium opacity-90">Escenario de Prospección</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold leading-tight">
                {scenario.title}
              </h2>
            </div>
            <Badge 
              variant="outline" 
              className="shrink-0 border animate-scale-in text-[10px] sm:text-xs bg-background/20 border-background/30"
            >
              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              {scenario.location}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* The Case Section */}
          <div className="space-y-2 sm:space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
              El Caso
            </h3>
            <div className="bg-muted/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border/50">
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {scenario.description}
              </p>
              <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  Edad objetivo: {scenario.targetAge}
                </Badge>
              </div>
            </div>
          </div>

          {/* Your Mission Section */}
          <div className="space-y-2 sm:space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tu Misión
            </h3>
            <div 
              className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-primary/30 animate-scale-in"
              style={{ animationDelay: "0.3s" }}
            >
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                Acércate al prospecto de manera natural, establece rapport y consigue su interés en los servicios funerarios. 
                Recuerda mantener una actitud empática y profesional.
              </p>
            </div>
          </div>

          {/* Video Preview if available */}
          {scenario.videoUrl && (
            <div className="space-y-2 sm:space-y-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Vista Previa del Escenario
              </h3>
              <div className="rounded-lg sm:rounded-xl overflow-hidden border border-border/50">
                <video
                  src={scenario.videoUrl}
                  className="w-full aspect-video object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
            </div>
          )}

          {/* Start Button */}
          <Button
            onClick={() => onStartPractice(scenario.id)}
            className="w-full h-11 sm:h-14 text-sm sm:text-lg font-bold uppercase tracking-wider animate-fade-in shadow-lg hover:shadow-xl transition-all duration-300"
            style={{ animationDelay: "0.4s" }}
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
            Iniciar Prospección
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProspectingPreviewModal;
