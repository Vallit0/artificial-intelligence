import { cn } from "@/lib/utils";

interface FeatureBadgeProps {
  children: React.ReactNode;
  className?: string;
}

const FeatureBadge = ({ children, className }: FeatureBadgeProps) => {
  return (
    <div
      className={cn(
        "px-4 py-2 bg-card border border-border rounded-full text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow cursor-default",
        className
      )}
    >
      {children}
    </div>
  );
};

export default FeatureBadge;
