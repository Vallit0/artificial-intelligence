import { cn } from "@/lib/utils";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface UnitBannerProps {
  section?: number;
  unit?: number;
  title: string;
  className?: string;
}

const UnitBanner = ({ section = 1, unit = 1, title, className }: UnitBannerProps) => {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "w-full bg-secondary rounded-2xl p-4 flex items-center justify-between",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-secondary-foreground hover:bg-secondary-foreground/10"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div>
          <p className="text-xs font-medium text-secondary-foreground/80 uppercase tracking-wide">
            SECCIÓN {section}, UNIDAD {unit}
          </p>
          <h2 className="text-lg font-bold text-secondary-foreground">{title}</h2>
        </div>
      </div>

      <Button
        variant="outline"
        className="bg-secondary-foreground text-secondary font-bold hover:bg-secondary-foreground/90 border-0"
      >
        <BookOpen className="w-4 h-4 mr-2" />
        GUÍA
      </Button>
    </div>
  );
};

export default UnitBanner;
