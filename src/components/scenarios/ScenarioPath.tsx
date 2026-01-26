import { cn } from "@/lib/utils";

interface ScenarioPathProps {
  direction: "left" | "right" | "center";
  className?: string;
}

const ScenarioPath = ({ direction, className }: ScenarioPathProps) => {
  return (
    <div className={cn("flex justify-center py-2", className)}>
      <svg
        width="40"
        height="30"
        viewBox="0 0 40 30"
        className="text-muted-foreground/30"
      >
        {direction === "center" && (
          <line
            x1="20"
            y1="0"
            x2="20"
            y2="30"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        )}
        {direction === "left" && (
          <path
            d="M 30 0 Q 20 15 10 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        )}
        {direction === "right" && (
          <path
            d="M 10 0 Q 20 15 30 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        )}
      </svg>
    </div>
  );
};

export default ScenarioPath;
