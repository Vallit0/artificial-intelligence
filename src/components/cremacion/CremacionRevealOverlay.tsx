import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLevelMode } from "@/hooks/useLevelMode";
import { CremacionIcon } from "@/lib/cremacion-theme";

// "Mini evento" que se reproduce al encender la pista Cremación: una ola
// cálida cubre la pantalla, suben chispas suaves y la interfaz queda en naranja
// al disiparse. No son llamas: son destellos. Sale cada vez hasta que el
// usuario pulsa "No mostrar de nuevo"; desde el menú de usuario se puede
// volver a habilitar.
const DURATION_MS = 3600;

const SPARKS = Array.from({ length: 46 }, (_, i) => {
  // Pseudo-aleatorio determinista para no cambiar en cada render.
  const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
  return {
    left: 2 + r(1) * 96,
    size: 3 + r(2) * 6,
    delay: r(3) * 0.9,
    duration: 1.3 + r(4) * 1.1,
    drift: (r(5) - 0.5) * 120,
    hue: r(6) > 0.5 ? "#fde68a" : "#fdba74",
  };
});

const CremacionRevealOverlay = () => {
  const { revealToken, replayReveal, dismissReveal } = useLevelMode();
  const [searchParams] = useSearchParams();
  const [visible, setVisible] = useState(false);

  // Soporte de demo: /practice?cremacionIntro=1 vuelve a mostrar la animación.
  useEffect(() => {
    if (searchParams.get("cremacionIntro") === "1") replayReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealToken) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(t);
  }, [revealToken]);

  const sparks = useMemo(() => SPARKS, []);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissReveal();
    setVisible(false);
  };

  return (
    <div
      key={revealToken}
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden"
      role="dialog"
      aria-label="Bienvenida a Cremación"
      style={{ animation: `cremacionRevealFade ${DURATION_MS}ms ease-in-out forwards` }}
    >
      {/* Ola naranja que se expande desde abajo a la izquierda (donde vive el toggle) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 88%, rgba(251,146,60,0.92) 0%, rgba(249,115,22,0.82) 35%, rgba(245,158,11,0.7) 60%, rgba(255,237,213,0.55) 100%)",
          animation: "cremacionWave 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        }}
      />

      {/* Chispas suaves que suben */}
      {sparks.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-[-10px] block rounded-full"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            background: `radial-gradient(circle, #ffffff 0%, ${s.hue} 55%, rgba(251,146,60,0) 100%)`,
            boxShadow: `0 0 ${s.size * 2}px ${s.hue}`,
            animation: `cremacionSpark ${s.duration}s cubic-bezier(0.2, 0.8, 0.3, 1) ${0.35 + s.delay}s both`,
            ["--drift" as string]: `${s.drift}px`,
          }}
        />
      ))}

      {/* Mensaje central */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex flex-col items-center text-center px-6"
          style={{ animation: "cremacionTitle 2.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both" }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/90 text-orange-500 shadow-2xl mb-4">
            <CremacionIcon className="h-9 w-9" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/90 drop-shadow">
            Nueva campaña
          </p>
          <p
            className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg leading-tight"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            Cremación
          </p>
          <p className="text-sm sm:text-base text-white/90 mt-1 drop-shadow">
            Una despedida ligera, con luz y sin cargas
          </p>
        </div>
      </div>

      {/* Controles (sí reciben clics) */}
      <div
        className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 pointer-events-auto"
        style={{ animation: "cremacionControls 0.5s ease-out 0.6s both" }}
      >
        <button
          onClick={() => setVisible(false)}
          className="rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur hover:bg-white/30 transition-colors"
        >
          Cerrar
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-orange-600 shadow-lg hover:bg-orange-50 transition-colors"
        >
          No mostrar de nuevo
        </button>
      </div>

      <style>{`
        @keyframes cremacionWave {
          0% { clip-path: circle(0% at 12% 88%); opacity: 1; }
          100% { clip-path: circle(160% at 12% 88%); opacity: 1; }
        }
        @keyframes cremacionSpark {
          0% { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), -105vh, 0) scale(1.1); opacity: 0; }
        }
        @keyframes cremacionTitle {
          0% { opacity: 0; transform: translateY(18px) scale(0.85); }
          18% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cremacionRevealFade {
          0%, 78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes cremacionControls {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CremacionRevealOverlay;
