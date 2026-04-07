import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { PAGE_TIPS, DEFAULT_TIP } from "./TipBanner";
import AICompanionOrb from "./AICompanionOrb";

interface LegadoClippyProps {
  currentPage: number;
  visible: boolean;
}

const orbPositions = [
  { bottom: "6%", right: "4%", top: "auto", left: "auto" },
  { bottom: "auto", right: "auto", top: "20%", left: "5%" },
  { bottom: "15%", right: "auto", top: "auto", left: "8%" },
  { bottom: "auto", right: "5%", top: "15%", left: "auto" },
  { bottom: "40%", right: "auto", top: "auto", left: "3%" },
  { bottom: "auto", right: "3%", top: "40%", left: "auto" },
  { bottom: "25%", right: "6%", top: "auto", left: "auto" },
  { bottom: "auto", right: "auto", top: "30%", left: "6%" },
];

const LegadoClippy = ({ currentPage, visible }: LegadoClippyProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const showBubble = !dismissed;

  const position = useMemo(
    () => orbPositions[(currentPage - 1) % orbPositions.length],
    [currentPage]
  );

  useEffect(() => {
    setDismissed(false);
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [currentPage]);

  if (!visible) return null;

  const tip = PAGE_TIPS[currentPage] || DEFAULT_TIP;

  return (
    <div
      className="fixed z-50 flex flex-col items-end gap-2"
      style={{
        bottom: position.bottom,
        right: position.right,
        top: position.top,
        left: position.left,
        transition: "all 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {showBubble && (
        <div
          className={`
            max-w-[280px] bg-card border-2 border-cyan-400/30 dark:border-cyan-600/30 rounded-2xl rounded-br-sm
            p-4 shadow-xl transition-all duration-500 relative
            ${animating ? "opacity-0 translate-y-3 scale-90" : "opacity-100 translate-y-0 scale-100"}
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
            Página {currentPage}
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
