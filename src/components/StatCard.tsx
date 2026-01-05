import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string;
  label: string;
  className?: string;
}

const StatCard = ({ value, label, className }: StatCardProps) => {
  return (
    <div className={cn("text-left", className)}>
      <p className="text-4xl md:text-5xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
};

export default StatCard;
