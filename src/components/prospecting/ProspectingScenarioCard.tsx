import { cn } from "@/lib/utils";
import { MapPin, User, Coffee, Car, ShoppingCart, Building, TreePine } from "lucide-react";

export interface ProspectingScenario {
  id: number;
  title: string;
  description: string;
  location: string;
  targetAge: string;
  icon: "supermarket" | "restaurant" | "parking" | "mall" | "street" | "cemetery";
}

interface ProspectingScenarioCardProps {
  scenario: ProspectingScenario;
  isSelected: boolean;
  onClick: () => void;
}

const iconMap = {
  supermarket: ShoppingCart,
  restaurant: Coffee,
  parking: Car,
  mall: Building,
  street: MapPin,
  cemetery: TreePine,
};

const ProspectingScenarioCard = ({ scenario, isSelected, onClick }: ProspectingScenarioCardProps) => {
  const Icon = iconMap[scenario.icon];

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full p-4 sm:p-6 rounded-2xl border-2 transition-all duration-300 text-left",
        "hover:scale-[1.02] hover:shadow-lg",
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border bg-card hover:border-primary/50"
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight">
            {scenario.title}
          </h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>{scenario.targetAge}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
        {scenario.description}
      </p>

      {/* Location badge */}
      <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
        <MapPin className="w-3 h-3" />
        {scenario.location}
      </div>
    </button>
  );
};

export default ProspectingScenarioCard;
