import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, GraduationCap } from "lucide-react";
import type { AICharacter } from "@/pages/Landing";
import { cn } from "@/lib/utils";

interface AvatarCardProps {
  character: AICharacter;
  onSelect: () => void;
}

export const AvatarCard = ({ character, onSelect }: AvatarCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-3xl bg-gradient-to-br opacity-0 blur-xl transition-opacity duration-500",
          character.gradient,
          isHovered && "opacity-30"
        )}
      />

      {/* Card */}
      <div
        className={cn(
          "relative flex flex-col items-center p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-sm transition-all duration-300",
          "hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
          "w-[280px]"
        )}
      >
        {/* Avatar Orb */}
        <div
          className={cn(
            "w-32 h-32 rounded-full bg-gradient-to-br flex items-center justify-center mb-6 transition-transform duration-300",
            character.gradient,
            isHovered && "scale-110"
          )}
        >
          <span className="text-4xl font-bold text-white">
            {character.name[0]}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-2xl font-bold text-foreground mb-1">
          {character.name}
        </h2>

        {/* Role badge */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
          {character.role === "client" ? (
            <>
              <MessageCircle className="h-4 w-4" />
              <span>{character.description}</span>
            </>
          ) : (
            <>
              <GraduationCap className="h-4 w-4" />
              <span>{character.description}</span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground text-center mb-6 line-clamp-3">
          {character.personality}
        </p>

        {/* CTA Button */}
        <Button
          className={cn(
            "w-full bg-gradient-to-r text-white border-0",
            character.gradient,
            "hover:opacity-90"
          )}
        >
          Hablar con {character.name}
        </Button>
      </div>
    </div>
  );
};
