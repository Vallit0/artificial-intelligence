import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "./useAuth";

export type Level = 1 | 2;

// Línea de producto ("pista") sobre la que se practica. Es ortogonal al
// módulo: tanto Prospección como Objeciones pueden entrenarse para el
// producto tradicional o para Cremación. Cremación cambia el coach / role
// plays (sufijo `_CREMACION` en el secret name), la paleta (naranja) y habilita
// el buscador de productos.
export type Track = "tradicional" | "cremacion";

// Nombre de cara al usuario de cada módulo. La plataforma ya no habla de
// "niveles": el módulo 1 es "Prospección" y el módulo 2 "Objeciones".
export const levelLabel = (level: Level): string =>
  level === 1 ? "Prospección" : "Objeciones";

export const trackLabel = (track: Track): string =>
  track === "cremacion" ? "Cremación" : "Tradicional";

// Etiqueta compuesta: "Prospección" / "Prospección · Cremación".
export const moduleLabel = (level: Level, track: Track): string =>
  track === "cremacion" ? `${levelLabel(level)} · Cremación` : levelLabel(level);

interface LevelModeContextValue {
  currentLevel: Level;
  // Sets a local override that persists in localStorage. Disponible para
  // cualquier usuario autenticado: todos pueden alternar entre Prospección y
  // Objeciones. Para usuarios anónimos (free tier) es un no-op.
  setLevel: (level: Level) => void;
  toggle: () => void;
  // True when the user has manually overridden their level (so we know the
  // toggle has been used and the displayed level isn't just derived from the
  // unlock flag).
  isOverridden: boolean;
  // Whether the current user is allowed to switch levels (admin, or advisor
  // with Level 2 unlocked). UIs should hide the toggle when this is false.
  canSwitchLevel: boolean;
  resetOverride: () => void;
  // Timestamp of last level change. Components compare to Date.now() to decide
  // whether to play the entry animation — this prevents pop animations from
  // re-running on every page navigation that remounts the sidebar.
  lastChangeAt: number;
  // Línea de producto activa (tradicional | cremacion). Persistida en
  // localStorage igual que el override de módulo.
  currentTrack: Track;
  isCremacion: boolean;
  setTrack: (track: Track) => void;
  toggleTrack: () => void;
  // Timestamp que dispara la animación de bienvenida a Cremación (0 = nada).
  // Se emite la PRIMERA vez que el usuario enciende la pista en este
  // navegador; replayReveal() la vuelve a mostrar (demo / QA).
  revealToken: number;
  replayReveal: () => void;
}

const LevelModeContext = createContext<LevelModeContextValue | undefined>(undefined);

const STORAGE_KEY = "senoriales:admin-level-override";
const TRACK_STORAGE_KEY = "senoriales:product-track";
const CREMACION_INTRO_SEEN_KEY = "senoriales:cremacion-intro-seen";

function readTrack(): Track {
  if (typeof window === "undefined") return "tradicional";
  return localStorage.getItem(TRACK_STORAGE_KEY) === "cremacion" ? "cremacion" : "tradicional";
}

function writeTrack(track: Track) {
  if (typeof window === "undefined") return;
  if (track === "tradicional") {
    localStorage.removeItem(TRACK_STORAGE_KEY);
  } else {
    localStorage.setItem(TRACK_STORAGE_KEY, track);
  }
}

function readOverride(): Level | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  return null;
}

function writeOverride(level: Level | null) {
  if (typeof window === "undefined") return;
  if (level === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, String(level));
  }
}

export const LevelModeProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, roles } = useAuth();
  const isCoach = roles.includes("coach");
  const [override, setOverride] = useState<Level | null>(() => readOverride());
  const [lastChangeAt, setLastChangeAt] = useState(0);
  const [track, setTrackState] = useState<Track>(() => readTrack());
  const [revealToken, setRevealToken] = useState(0);

  // Drop the override when the user logs out so the next login starts clean.
  useEffect(() => {
    if (!user) {
      setOverride(null);
      writeOverride(null);
      setTrackState("tradicional");
      writeTrack("tradicional");
    }
  }, [user]);

  // Todos los usuarios tienen ambos módulos abiertos (Prospección y Objeciones).
  // El flag level2Unlocked ya NO controla el acceso —cualquier usuario puede
  // alternar—; solo define en qué módulo aterriza por defecto quien ya avanzó.
  const baseLevel: Level = user?.level2Unlocked ? 2 : 1;
  // Cualquier usuario autenticado puede alternar libremente entre Prospección
  // (1) y Objeciones (2). Admins y coaches también, para previsualizar.
  const canSwitchLevel = isAdmin || isCoach || !!user;
  const currentLevel: Level = canSwitchLevel && override !== null ? override : baseLevel;

  // When the underlying baseLevel flips (e.g., student passes the exam), bump
  // the timestamp so the navbar animates the transition. We also drop a stale
  // override on the 1→2 transition so the user lands on the freshly-unlocked
  // Level 2 instead of being pinned to a leftover Level 1 override (e.g., from
  // an admin testing the exam flow, or from a future signed-out preview).
  const prevBaseRef = useState<{ value: Level }>(() => ({ value: baseLevel }))[0];
  useEffect(() => {
    if (prevBaseRef.value !== baseLevel) {
      const prev = prevBaseRef.value;
      prevBaseRef.value = baseLevel;
      setLastChangeAt(Date.now());
      if (prev === 1 && baseLevel === 2) {
        setOverride(null);
        writeOverride(null);
      }
    }
  }, [baseLevel, prevBaseRef]);

  const setLevel = useCallback(
    (level: Level) => {
      if (!canSwitchLevel) return;
      setOverride(level);
      writeOverride(level);
      setLastChangeAt(Date.now());
    },
    [canSwitchLevel],
  );

  const toggle = useCallback(() => {
    if (!canSwitchLevel) return;
    const next: Level = currentLevel === 1 ? 2 : 1;
    setOverride(next);
    writeOverride(next);
    setLastChangeAt(Date.now());
  }, [canSwitchLevel, currentLevel]);

  const resetOverride = useCallback(() => {
    setOverride(null);
    writeOverride(null);
  }, []);

  const replayReveal = useCallback(() => {
    setRevealToken(Date.now());
  }, []);

  const setTrack = useCallback(
    (next: Track) => {
      setTrackState(next);
      writeTrack(next);
      setLastChangeAt(Date.now());
      // Mini evento de bienvenida sólo la primera vez que se enciende Cremación.
      if (next === "cremacion" && typeof window !== "undefined") {
        try {
          if (!localStorage.getItem(CREMACION_INTRO_SEEN_KEY)) {
            localStorage.setItem(CREMACION_INTRO_SEEN_KEY, String(Date.now()));
            replayReveal();
          }
        } catch {
          /* localStorage no disponible: sin animación, sin error */
        }
      }
    },
    [replayReveal],
  );

  const toggleTrack = useCallback(() => {
    setTrack(track === "cremacion" ? "tradicional" : "cremacion");
  }, [setTrack, track]);

  const value = useMemo<LevelModeContextValue>(
    () => ({
      currentLevel,
      setLevel,
      toggle,
      isOverridden: override !== null,
      canSwitchLevel,
      resetOverride,
      lastChangeAt,
      currentTrack: track,
      isCremacion: track === "cremacion",
      setTrack,
      toggleTrack,
      revealToken,
      replayReveal,
    }),
    [currentLevel, setLevel, toggle, override, canSwitchLevel, resetOverride, lastChangeAt, track, setTrack, toggleTrack, revealToken, replayReveal],
  );

  return <LevelModeContext.Provider value={value}>{children}</LevelModeContext.Provider>;
};

export const useLevelMode = (): LevelModeContextValue => {
  const ctx = useContext(LevelModeContext);
  if (!ctx) throw new Error("useLevelMode must be used inside <LevelModeProvider>");
  return ctx;
};

// True when the level changed within the last `windowMs` ms.  Use to gate
// entry animations so they only fire on actual transitions, not on every
// page navigation that remounts the sidebar.
export const useDidLevelJustChange = (windowMs = 800): boolean => {
  const { lastChangeAt } = useLevelMode();
  if (lastChangeAt === 0) return false;
  return Date.now() - lastChangeAt < windowMs;
};
