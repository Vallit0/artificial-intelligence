import { cn } from "@/lib/utils";
import { MapPin, User, Coffee, Car, ShoppingCart, Building, TreePine } from "lucide-react";

export interface ProspectingScenario {
  id: number;
  title: string;
  description: string;
  location: string;
  targetAge: string;
  icon: "supermarket" | "restaurant" | "parking" | "mall" | "street" | "cemetery";
  videoUrl?: string;
}

interface ProspectingScenarioCardProps {
  scenario: ProspectingScenario;
  isSelected: boolean;
  onClick: () => void;
  isDisabled?: boolean;
}

const iconMap = {
  supermarket: ShoppingCart,
  restaurant: Coffee,
  parking: Car,
  mall: Building,
  street: MapPin,
  cemetery: TreePine,
};

const ProspectingScenarioCard = ({ scenario, isSelected, onClick, isDisabled = false }: ProspectingScenarioCardProps) => {
  const Icon = iconMap[scenario.icon];

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={cn(
        "relative w-full rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden",
        isDisabled
          ? "opacity-50 grayscale cursor-not-allowed border-border bg-muted"
          : "hover:scale-[1.02] hover:shadow-lg",
        !isDisabled && isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : !isDisabled && "border-border bg-card hover:border-primary/50"
      )}
    >
      {/* Video Preview */}
      {scenario.videoUrl && (
        <div className="relative w-full aspect-video bg-muted">
          <video
            src={scenario.videoUrl}
            muted
            loop
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center z-10">
            <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight">
              {scenario.title}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>{scenario.targetAge}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {scenario.description}
        </p>

        {/* Location badge */}
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {scenario.location}
        </div>
      </div>
    </button>
  );
};

export default ProspectingScenarioCard;
