import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AICompanionOrbProps {
  size?: "sm" | "md" | "lg";
  speaking?: boolean;
  listening?: boolean;
  /** Energy mode: no face, abstract reactive orb */
  energy?: boolean;
  /** Trigger wink → dissolve transition */
  winkOut?: boolean;
  onWinkOutDone?: () => void;
  /** Override the orb gradient (CSS linear-gradient value) */
  gradient?: string;
  /** Enable interactive behaviors (mouse tracking, poke) */
  interactive?: boolean;
  /** Callback when user pokes the orb */
  onPoke?: () => void;
  className?: string;
}

const AICompanionOrb = ({
  size = "md",
  speaking = false,
  listening = false,
  energy = false,
  winkOut = false,
  onWinkOutDone,
  gradient,
  interactive = false,
  onPoke,
  className,
}: AICompanionOrbProps) => {
  const [winkPhase, setWinkPhase] = useState<"idle" | "wink" | "dissolve" | "gone">("idle");
  const [pokeState, setPokeState] = useState<"idle" | "annoyed" | "angry">("idle");
  const [pokeCount, setPokeCount] = useState(0);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [mouseNear, setMouseNear] = useState(false);
  const orbRef = useRef<HTMLDivElement>(null);
  const pokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mouse tracking for eyes
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!orbRef.current || !interactive || energy) return;
    const rect = orbRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 300;

    if (dist < maxDist) {
      setMouseNear(true);
      const maxOffset = 6;
      const factor = Math.min(dist / maxDist, 1);
      const angle = Math.atan2(dy, dx);
      setEyeOffset({
        x: Math.cos(angle) * maxOffset * factor,
        y: Math.sin(angle) * maxOffset * factor,
      });
    } else {
      setMouseNear(false);
      setEyeOffset({ x: 0, y: 0 });
    }
  }, [interactive, energy]);

  useEffect(() => {
    if (!interactive || energy) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [interactive, energy, handleMouseMove]);

  // Poke handler
  const handlePoke = useCallback(() => {
    if (!interactive || energy || winkPhase !== "idle") return;
    const newCount = pokeCount + 1;
    setPokeCount(newCount);
    onPoke?.();

    if (pokeTimeoutRef.current) clearTimeout(pokeTimeoutRef.current);

    if (newCount >= 3) {
      setPokeState("angry");
      pokeTimeoutRef.current = setTimeout(() => {
        setPokeState("idle");
        setPokeCount(0);
      }, 2000);
    } else {
      setPokeState("annoyed");
      pokeTimeoutRef.current = setTimeout(() => {
        setPokeState("idle");
        setPokeCount(0);
      }, 1500);
    }
  }, [interactive, energy, winkPhase, pokeCount, onPoke]);

  useEffect(() => {
    if (winkOut && winkPhase === "idle") {
      setWinkPhase("wink");
      const t1 = setTimeout(() => setWinkPhase("dissolve"), 600);
      const t2 = setTimeout(() => {
        setWinkPhase("gone");
        onWinkOutDone?.();
      }, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!winkOut && winkPhase !== "idle") {
      setWinkPhase("idle");
    }
  }, [winkOut, winkPhase, onWinkOutDone]);

  const sizeMap = {
    sm: { orb: 80, eye: 5, eyeGap: 14, glowScale: 1.5 },
    md: { orb: 120, eye: 7, eyeGap: 20, glowScale: 1.5 },
    lg: { orb: 200, eye: 11, eyeGap: 32, glowScale: 1.5 },
  };

  const s = sizeMap[size];
  const orbPx = `${s.orb}px`;
  const eyeW = s.eye;
  const eyeH = s.eye * 2.8;

  if (winkPhase === "gone") return null;

  // ============================================
  // Energy mode: abstract reactive orb, no face
  // ============================================
  if (energy) {
    return (
      <div
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: s.orb * s.glowScale, height: s.orb * s.glowScale }}
      >
        {/* Outer energy waves */}
        <div
          className="absolute rounded-full"
          style={{
            width: s.orb * 1.6,
            height: s.orb * 1.6,
            background: "radial-gradient(circle, rgba(0,245,212,0.12) 0%, transparent 70%)",
            animation: speaking
              ? "energyWave 0.4s ease-in-out infinite alternate"
              : "energyWave 2.5s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: s.orb * 1.35,
            height: s.orb * 1.35,
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
            animation: speaking
              ? "energyWave2 0.5s ease-in-out infinite alternate"
              : "energyWave2 3s ease-in-out infinite alternate",
          }}
        />

        {/* Core energy orb */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width: orbPx,
            height: orbPx,
            background: gradient
              ? gradient
              : speaking
                ? "radial-gradient(circle at 40% 40%, #22d3ee, #a855f7, #06d6a0, #3b82f6)"
                : "radial-gradient(circle at 40% 40%, #06b6d4, #7c3aed, #059669)",
            backgroundSize: "300% 300%",
            animation: speaking
              ? "energyGradient 0.8s ease-in-out infinite, energyPulseCore 0.3s ease-in-out infinite alternate"
              : listening
                ? "energyGradient 3s ease-in-out infinite, energyBreath 2s ease-in-out infinite"
                : "energyGradient 5s ease-in-out infinite",
            boxShadow: speaking
              ? `0 0 ${s.orb * 0.5}px rgba(34,211,238,0.5), 0 0 ${s.orb}px rgba(139,92,246,0.2)`
              : `0 0 ${s.orb * 0.3}px rgba(6,182,212,0.3)`,
            transition: "box-shadow 0.3s ease",
          }}
        >
          {/* Inner aurora spin */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, rgba(0,245,212,0.4) 25%, transparent 50%, rgba(168,85,247,0.4) 75%, transparent 100%)",
              animation: speaking
                ? "orbAuroraRotate 1s linear infinite"
                : "orbAuroraRotate 6s linear infinite",
              opacity: 0.6,
            }}
          />
          {/* Glass highlight */}
          <div
            className="absolute rounded-full"
            style={{
              width: s.orb * 0.5,
              height: s.orb * 0.35,
              top: s.orb * 0.1,
              left: s.orb * 0.15,
              background: "radial-gradient(ellipse, rgba(255,255,255,0.3) 0%, transparent 70%)",
              filter: "blur(3px)",
            }}
          />
        </div>

        <style>{`
          @keyframes energyGradient {
            0%, 100% { background-position: 0% 50%; }
            33% { background-position: 100% 0%; }
            66% { background-position: 50% 100%; }
          }
          @keyframes energyWave {
            from { transform: scale(1); opacity: 0.4; }
            to { transform: scale(1.2); opacity: 0.7; }
          }
          @keyframes energyWave2 {
            from { transform: scale(1.05); opacity: 0.3; }
            to { transform: scale(1.25); opacity: 0.6; }
          }
          @keyframes energyPulseCore {
            from { transform: scale(1); }
            to { transform: scale(1.08); }
          }
          @keyframes energyBreath {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.04); }
          }
          @keyframes orbAuroraRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ============================================
  // Companion mode: face with expressions
  // ============================================
  const isWinking = winkPhase === "wink";
  const isDissolving = winkPhase === "dissolve";

  const pokeShake = pokeState === "angry"
    ? "orbAngryShake 0.15s ease-in-out infinite"
    : pokeState === "annoyed"
      ? "orbAnnoyedShake 0.3s ease-in-out"
      : "";

  return (
    <div
      ref={orbRef}
      className={cn("relative flex items-center justify-center", interactive && !energy ? "cursor-pointer" : "", className)}
      onClick={handlePoke}
      style={{
        width: s.orb * s.glowScale,
        height: s.orb * s.glowScale,
        transition: "transform 0.5s ease, opacity 0.5s ease",
        transform: isDissolving ? "scale(0.3)" : "scale(1)",
        opacity: isDissolving ? 0 : 1,
        animation: isDissolving
          ? "none"
          : pokeShake
            ? pokeShake
            : "orbHeadBob 6s ease-in-out infinite",
      }}
    >
      {/* Aurora glow */}
      <div
        className="absolute rounded-full opacity-40 blur-2xl"
        style={{
          width: s.orb * 1.4,
          height: s.orb * 1.4,
          background: "radial-gradient(circle, rgba(0,245,212,0.4) 0%, rgba(139,92,246,0.3) 50%, rgba(6,182,212,0.1) 100%)",
          animation: "orbAuroraRotate 6s linear infinite",
        }}
      />

      {/* Outer pulse */}
      <div
        className="absolute rounded-full"
        style={{
          width: s.orb * 1.25,
          height: s.orb * 1.25,
          background: "radial-gradient(circle, rgba(0,245,212,0.15) 0%, transparent 70%)",
          animation: speaking
            ? "orbPulse 0.8s ease-in-out infinite"
            : listening
              ? "orbPulse 2s ease-in-out infinite"
              : "orbPulse 3s ease-in-out infinite",
        }}
      />

      {/* Main orb */}
      <div
        className="relative rounded-full overflow-hidden"
        style={{
          width: orbPx,
          height: orbPx,
          background: gradient || "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 40%, #06d6a0 70%, #0ea5e9 100%)",
          backgroundSize: "200% 200%",
          animation: speaking
            ? "orbGradient 1.5s ease-in-out infinite, orbBounce 0.6s ease-in-out infinite"
            : "orbGradient 4s ease-in-out infinite",
          boxShadow: `
            0 0 ${s.orb * 0.3}px rgba(6,182,212,0.3),
            inset 0 -${s.orb * 0.15}px ${s.orb * 0.3}px rgba(139,92,246,0.3),
            inset 0 ${s.orb * 0.1}px ${s.orb * 0.2}px rgba(255,255,255,0.2)
          `,
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: s.orb * 0.7,
            height: s.orb * 0.5,
            top: s.orb * 0.08,
            left: s.orb * 0.12,
            background: "radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full opacity-50"
          style={{
            background: "conic-gradient(from 0deg, transparent, rgba(0,245,212,0.3), transparent, rgba(139,92,246,0.3), transparent)",
            animation: "orbAuroraRotate 8s linear infinite",
          }}
        />
      </div>

      {/* Eyes - expressive */}
      <div
        className="absolute flex items-center pointer-events-none"
        style={{
          gap: s.eyeGap,
          top: "50%",
          left: "50%",
          transform: mouseNear && pokeState === "idle"
            ? `translate(calc(-50% + ${eyeOffset.x}px), calc(-55% + ${eyeOffset.y}px))`
            : "translate(-50%, -55%)",
          transition: mouseNear ? "transform 0.1s ease-out" : "transform 0.3s ease-out",
          animation: isWinking || mouseNear || pokeState !== "idle" ? "none" : "orbLookAround 7s ease-in-out infinite",
        }}
      >
        {/* Left eye */}
        <div
          style={{
            width: eyeW,
            height: pokeState === "angry" ? eyeH * 0.3 : pokeState === "annoyed" ? eyeH * 0.5 : eyeH,
            borderRadius: `${eyeW}px`,
            backgroundColor: "white",
            boxShadow: `0 0 ${s.eye * 1.5}px rgba(255,255,255,0.9)`,
            animation: isWinking
              ? "orbWinkLeft 0.6s ease-in-out forwards"
              : pokeState !== "idle"
                ? "none"
                : "orbExpressive 5s ease-in-out infinite",
            transition: "height 0.15s ease-out",
          }}
        />
        {/* Right eye */}
        <div
          style={{
            width: eyeW,
            height: pokeState === "angry" ? eyeH * 0.3 : pokeState === "annoyed" ? eyeH * 0.5 : eyeH,
            borderRadius: `${eyeW}px`,
            backgroundColor: "white",
            boxShadow: `0 0 ${s.eye * 1.5}px rgba(255,255,255,0.9)`,
            animation: isWinking
              ? "orbWinkRight 0.6s ease-in-out forwards"
              : pokeState !== "idle"
                ? "none"
                : "orbExpressive 5s ease-in-out infinite",
            animationDelay: isWinking ? "0s" : "0.2s",
            transition: "height 0.15s ease-out",
          }}
        />
      </div>

      {/* Annoyed mouth - shows when poked */}
      {pokeState !== "idle" && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: "62%",
            left: "50%",
            transform: "translateX(-50%)",
            width: pokeState === "angry" ? s.eye * 3 : s.eye * 2,
            height: pokeState === "angry" ? s.eye * 0.8 : s.eye * 0.5,
            borderRadius: "0 0 50% 50%",
            backgroundColor: "white",
            boxShadow: `0 0 ${s.eye}px rgba(255,255,255,0.8)`,
            transition: "all 0.15s ease-out",
          }}
        />
      )}

      <style>{`
        @keyframes orbGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes orbBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes orbExpressive {
          0%, 10% { transform: scaleY(1) scaleX(1); }
          12% { transform: scaleY(0.05) scaleX(1.3); }
          14%, 22% { transform: scaleY(1) scaleX(1); }
          24% { transform: scaleY(0.05) scaleX(1.3); }
          26%, 38% { transform: scaleY(1) scaleX(1); }
          42%, 48% { transform: scaleY(1.25) scaleX(0.85); }
          52%, 62% { transform: scaleY(1) scaleX(1); }
          66%, 70% { transform: scaleY(0.6) scaleX(1.2); }
          74%, 85% { transform: scaleY(1) scaleX(1); }
          88% { transform: scaleY(0.05) scaleX(1.3); }
          91%, 100% { transform: scaleY(1) scaleX(1); }
        }
        @keyframes orbLookAround {
          0%, 8% { transform: translate(-50%, -55%) translate(0, 0); }
          12%, 18% { transform: translate(-50%, -55%) translate(${s.eye * 3}px, -${s.eye * 1}px); }
          22%, 26% { transform: translate(-50%, -55%) translate(0, 0); }
          30%, 36% { transform: translate(-50%, -55%) translate(-${s.eye * 3.5}px, ${s.eye * 0.5}px); }
          40%, 44% { transform: translate(-50%, -55%) translate(0, 0); }
          48%, 54% { transform: translate(-50%, -55%) translate(${s.eye * 1.5}px, -${s.eye * 1.5}px); }
          58%, 62% { transform: translate(-50%, -55%) translate(-${s.eye * 2}px, -${s.eye * 1}px); }
          66%, 72% { transform: translate(-50%, -55%) translate(${s.eye * 2.5}px, ${s.eye * 1}px); }
          76%, 82% { transform: translate(-50%, -55%) translate(0, ${s.eye * 0.8}px); }
          86%, 92% { transform: translate(-50%, -55%) translate(-${s.eye * 1}px, 0); }
          96%, 100% { transform: translate(-50%, -55%) translate(0, 0); }
        }
        @keyframes orbWinkLeft {
          0% { transform: scaleY(1); }
          30% { transform: scaleY(1); }
          50% { transform: scaleY(0.06) scaleX(1.3); }
          100% { transform: scaleY(0.06) scaleX(1.3); }
        }
        @keyframes orbWinkRight {
          0% { transform: scaleY(1); }
          30%, 60% { transform: scaleY(1); }
          100% { transform: scaleY(1); }
        }
        @keyframes orbAuroraRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbHeadBob {
          0%, 10% { transform: translate(0, 0) rotate(0deg); }
          15%, 25% { transform: translate(3px, -5px) rotate(3deg); }
          30%, 40% { transform: translate(-2px, 2px) rotate(-2deg); }
          45%, 55% { transform: translate(4px, -3px) rotate(4deg); }
          60%, 70% { transform: translate(-4px, -2px) rotate(-3deg); }
          75%, 85% { transform: translate(2px, 4px) rotate(2deg); }
          90%, 100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes orbAnnoyedShake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-4px) rotate(-2deg); }
          40% { transform: translateX(4px) rotate(2deg); }
          60% { transform: translateX(-3px) rotate(-1deg); }
          80% { transform: translateX(2px) rotate(1deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes orbAngryShake {
          0% { transform: translateX(-3px) rotate(-3deg); }
          50% { transform: translateX(3px) rotate(3deg); }
          100% { transform: translateX(-3px) rotate(-3deg); }
        }
      `}</style>
    </div>
  );
};

export default AICompanionOrb;
