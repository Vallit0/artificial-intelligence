import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { PAGE_TIPS, DEFAULT_TIP } from "./TipBanner";
import AICompanionOrb from "./AICompanionOrb";

interface LegadoClippyProps {
  currentPage: number;
  visible: boolean;
}

const LegadoClippy = ({ currentPage, visible }: LegadoClippyProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const showBubble = !dismissed;

  useEffect(() => {
    setDismissed(false);
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [currentPage]);

  if (!visible) return null;

  const tip = PAGE_TIPS[currentPage] || DEFAULT_TIP;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 lg:bottom-6">
      {showBubble && (
        <div
          className={`
            max-w-[280px] bg-card border-2 border-cyan-400/30 dark:border-cyan-600/30 rounded-2xl rounded-br-sm
            p-4 shadow-xl transition-all duration-300 relative
            ${animating ? "opacity-0 translate-y-2 scale-95" : "opacity-100 translate-y-0 scale-100"}
          `}
        >
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="text-sm text-foreground/90 leading-relaxed pr-4">{tip}</p>
          <p className="text-[10px] text-muted-foreground mt-2 font-semibold uppercase tracking-wider">
            Pagina {currentPage}
          </p>
          <div className="absolute -bottom-2 right-10 w-4 h-4 bg-card border-b-2 border-r-2 border-cyan-400/30 dark:border-cyan-600/30 rotate-45" />
        </div>
      )}

      <button
        onClick={() => setDismissed((d) => !d)}
        className="hover:scale-110 transition-transform active:scale-95"
        title={dismissed ? "Mostrar tip" : "Ocultar tip"}
      >
        <AICompanionOrb size="sm" speaking={showBubble && !animating} />
      </button>
    </div>
  );
};

export default LegadoClippy;
