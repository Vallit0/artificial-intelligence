import { Cita } from "@/hooks/useCitas";
import { MapPin, Video, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Color map for directors (cycles through these)
const DIRECTOR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

const PRIORIDAD_DOT: Record<string, string> = {
  alta: "bg-red-500",
  media: "bg-yellow-400",
  baja: "bg-green-500",
};

const TIPO_ICON: Record<string, React.ReactNode> = {
  presencial: <MapPin className="w-3 h-3" />,
  virtual: <Video className="w-3 h-3" />,
  telefonica: <Phone className="w-3 h-3" />,
};

function getDirectorColor(director: string): string {
  let hash = 0;
  for (let i = 0; i < director.length; i++) {
    hash = director.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DIRECTOR_COLORS[Math.abs(hash) % DIRECTOR_COLORS.length];
}

interface CitaCardProps {
  cita: Cita;
  onClick: () => void;
  onDelete?: () => void;
  isAdmin: boolean;
}

export default function CitaCard({ cita, onClick, onDelete, isAdmin }: CitaCardProps) {
  const borderColor = getDirectorColor(cita.director);

  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 rounded-lg px-2 py-1.5 cursor-pointer",
        "bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow",
        "border border-zinc-200 dark:border-zinc-700 overflow-hidden group"
      )}
      style={{
        borderLeft: `3px solid ${borderColor}`,
        top: "2px",
        height: "calc(64px - 6px)",
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {cita.cliente}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {cita.municipio} Z.{cita.zona}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("w-2 h-2 rounded-full", PRIORIDAD_DOT[cita.prioridad])} />
          <span className="text-muted-foreground">{TIPO_ICON[cita.tipo]}</span>
        </div>
      </div>

      {/* Delete button - admin only, visible on hover */}
      {isAdmin && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 p-0.5 rounded bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
