import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, User, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/hooks/useScenarios";

interface ScenarioPreviewModalProps {
  scenario: Scenario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartPractice: (scenarioId: string) => void;
}

// Helper to extract name from persona text
function extractName(persona: string): string {
  // Try to find a name pattern like "María González" or "Juan Pérez"
  const nameMatch = persona.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
  if (nameMatch) return nameMatch[1];
  
  // Fallback: look for "es un/una [nombre]" pattern
  const altMatch = persona.match(/(?:llamad[oa]|nombre[s]?:?\s*)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
  if (altMatch) return altMatch[1];
  
  return "Cliente";
}

// Helper to extract age from persona text
function extractAge(persona: string): string | null {
  const ageMatch = persona.match(/(\d{1,2})\s*años/);
  return ageMatch ? `${ageMatch[1]} años` : null;
}

// Helper to get a brief personality summary
function extractPersonalitySummary(persona: string): string {
  // Take first sentence or first 100 chars
  const firstSentence = persona.split(/[.!?]/)[0];
  if (firstSentence.length > 120) {
    return firstSentence.substring(0, 117) + "...";
  }
  return firstSentence;
}

// Get difficulty config
function getDifficultyConfig(difficulty: string) {
  switch (difficulty?.toLowerCase()) {
    case "easy":
    case "fácil":
      return { 
        label: "Fácil", 
        className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
      };
    case "hard":
    case "difícil":
      return { 
        label: "Difícil", 
        className: "bg-rose-500/20 text-rose-400 border-rose-500/30" 
      };
    default:
      return { 
        label: "Intermedio", 
        className: "bg-amber-500/20 text-amber-400 border-amber-500/30" 
      };
  }
}

const ScenarioPreviewModal = ({
  scenario,
  open,
  onOpenChange,
  onStartPractice,
}: ScenarioPreviewModalProps) => {
  if (!scenario) return null;

  const clientName = extractName(scenario.client_persona);
  const clientAge = extractAge(scenario.client_persona);
  const personalitySummary = extractPersonalitySummary(scenario.client_persona);
  const difficultyConfig = getDifficultyConfig(scenario.difficulty);
  const isFemale = scenario.voice_type === "female";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/50 bg-card">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">Escenario de Práctica</span>
              </div>
              <h2 className="text-xl font-bold leading-tight">
                {scenario.name}
              </h2>
            </div>
            <Badge 
              variant="outline" 
              className={cn("shrink-0 border animate-scale-in", difficultyConfig.className)}
            >
              <Star className="w-3 h-3 mr-1" />
              {difficultyConfig.label}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* The Case Section */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              El Caso
            </h3>
            <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
              <p className="text-sm text-foreground leading-relaxed">
                {scenario.description || `El cliente responderá con "${scenario.objection}". Tu objetivo es manejar esta objeción de manera profesional y mantener la conversación.`}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Objeción: "{scenario.objection}"
                </Badge>
              </div>
            </div>
          </div>

          {/* Your Client Section */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tu Cliente
            </h3>
            <div 
              className="bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-xl p-4 border border-secondary/30 animate-scale-in"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Avatar className="w-16 h-16 border-2 border-secondary shadow-lg">
                  <AvatarFallback className={cn(
                    "text-xl font-bold",
                    isFemale 
                      ? "bg-pink-500/20 text-pink-400" 
                      : "bg-blue-500/20 text-blue-400"
                  )}>
                    {clientName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-foreground">{clientName}</h4>
                    {clientAge && (
                      <span className="text-sm text-muted-foreground">• {clientAge}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <User className="w-3 h-3 mr-1" />
                      Voz {isFemale ? "Femenina" : "Masculina"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {personalitySummary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={() => onStartPractice(scenario.id)}
            className="w-full h-14 text-lg font-bold uppercase tracking-wider animate-fade-in shadow-lg hover:shadow-xl transition-all duration-300"
            style={{ animationDelay: "0.4s" }}
          >
            <Play className="w-5 h-5 mr-2" />
            Empezar Práctica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScenarioPreviewModal;
