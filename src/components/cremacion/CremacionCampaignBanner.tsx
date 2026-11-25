import { CremacionIcon } from "@/lib/cremacion-theme";

// Partículas suaves (pétalos / semillas de diente de león) que flotan hacia
// arriba. Deliberadamente NO son llamas: la campaña de Cremación quiere
// transmitir calma, luz y ligereza, no fuego.
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: 4 + ((i * 37) % 92),
  size: 5 + ((i * 7) % 8),
  delay: (i * 0.9) % 7,
  duration: 9 + ((i * 3) % 6),
  drift: (i % 2 === 0 ? 1 : -1) * (8 + ((i * 5) % 14)),
  opacity: 0.35 + ((i * 11) % 40) / 100,
}));

interface Props {
  level: 1 | 2;
  compact?: boolean;
}

const CremacionCampaignBanner = ({ level, compact }: Props) => {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl border border-orange-400/30 text-left shadow-md ${
        compact ? "px-4 py-3" : "px-5 py-4 sm:px-6"
      }`}
      style={{
        background:
          "linear-gradient(120deg, #fff4e6 0%, #ffe3c2 35%, #ffd6a8 60%, #fff1dc 100%)",
        backgroundSize: "220% 220%",
        animation: "cremacionGlow 14s ease-in-out infinite",
      }}
      aria-label="Nueva campaña Cremación"
    >
      {/* Sol que amanece: un disco cálido que sube lentamente y respira */}
      <div
        className="pointer-events-none absolute -right-6 -bottom-10 h-32 w-32 rounded-full sm:h-40 sm:w-40"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(251,146,60,0.55) 0%, rgba(251,191,36,0.35) 45%, rgba(255,255,255,0) 72%)",
          animation: "cremacionSunrise 10s ease-in-out infinite",
        }}
      />

      {/* Pétalos flotando */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute bottom-0 block rounded-full"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.35,
            background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(253,186,116,0.8))",
            opacity: p.opacity,
            filter: "blur(0.2px)",
            animation: `cremacionFloat ${p.duration}s linear ${p.delay}s infinite`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}

      <div className="relative flex items-center gap-3 sm:gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #fb923c, #f59e0b)" }}
        >
          <CremacionIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700/80">
            Nueva campaña · {level === 1 ? "Prospección" : "Objeciones"}
          </p>
          <p
            className="text-base font-bold leading-tight text-orange-950 sm:text-lg"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            Cremación: una despedida ligera, con luz y sin cargas
          </p>
          {!compact && (
            <p className="mt-0.5 text-xs text-orange-900/70 sm:text-sm">
              Practica cómo presentarla con respeto, resuelve las dudas más comunes y consulta el
              catálogo durante la llamada.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cremacionGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes cremacionSunrise {
          0%, 100% { transform: translateY(14px) scale(0.92); opacity: 0.75; }
          50% { transform: translateY(-6px) scale(1.06); opacity: 1; }
        }
        @keyframes cremacionFloat {
          0% { transform: translate3d(0, 10px, 0) rotate(0deg); opacity: 0; }
          12% { opacity: var(--o, 0.6); }
          85% { opacity: var(--o, 0.6); }
          100% { transform: translate3d(var(--drift, 10px), -150px, 0) rotate(160deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-label="Nueva campaña Cremación"], [aria-label="Nueva campaña Cremación"] * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CremacionCampaignBanner;
