import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Sparkles } from "lucide-react";

interface LevelUpAnimationProps {
  onDone: () => void;
  durationMs?: number;
  level?: number;
  subtitle?: string;
}

const LevelUpAnimation = ({
  onDone,
  durationMs = 2600,
  level = 2,
  subtitle = "Manejo de Objeciones desbloqueado",
}: LevelUpAnimationProps) => {
  useEffect(() => {
    const end = Date.now() + durationMs;
    const colors = ["#a855f7", "#ec4899", "#facc15", "#06b6d4"];
    const burst = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.6 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();

    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.4 },
      colors,
    });

    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6 animate-fade-in"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(168,85,247,0.35), rgba(0,0,0,0.85) 70%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="relative flex flex-col items-center gap-4 text-center"
        style={{ animation: "levelUpPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <div
          className="relative w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #facc15 100%)",
            boxShadow: "0 0 80px rgba(168,85,247,0.6), 0 0 160px rgba(236,72,153,0.4)",
          }}
        >
          <Trophy className="w-16 h-16 text-white drop-shadow-lg" />
          <Sparkles
            className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300"
            style={{ animation: "sparkleSpin 2s linear infinite" }}
          />
          <Sparkles
            className="absolute -bottom-2 -left-2 w-6 h-6 text-pink-300"
            style={{ animation: "sparkleSpin 2.5s linear infinite reverse" }}
          />
        </div>

        <div className="space-y-1">
          <p
            className="text-sm font-bold uppercase tracking-[0.3em] text-white/70"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            ¡Felicidades!
          </p>
          <h1
            className="text-5xl sm:text-6xl font-bold text-white"
            style={{
              fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif",
              textShadow: "0 4px 24px rgba(168,85,247,0.6)",
            }}
          >
            Nivel {level}
          </h1>
          <p className="text-base text-white/80 max-w-xs">{subtitle}</p>
        </div>
      </div>

      <style>{`
        @keyframes levelUpPop {
          0% { opacity: 0; transform: scale(0.5); }
          60% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes sparkleSpin {
          from { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          to { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default LevelUpAnimation;
