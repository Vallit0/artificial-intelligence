import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "./useAuth";

export type Level = 1 | 2;

interface LevelModeContextValue {
  currentLevel: Level;
  // Sets a local override that persists in localStorage. Available to admins
  // (who can preview either level) and to advisors who have unlocked Level 2
  // (so they can still revisit Level 1 content like Prospección y Legado).
  // For non-admins without level2Unlocked this is a no-op.
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
}

const LevelModeContext = createContext<LevelModeContextValue | undefined>(undefined);

const STORAGE_KEY = "senoriales:admin-level-override";

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

  // Drop the override when the user logs out so the next login starts clean.
  useEffect(() => {
    if (!user) {
      setOverride(null);
      writeOverride(null);
    }
  }, [user]);

  const baseLevel: Level = user?.level2Unlocked ? 2 : 1;
  // An advisor can switch between Level 1 and Level 2 once Level 2 is unlocked
  // — Level 1 content (Prospección, Legado de Vida) stays available alongside
  // the new Level 2 modules. Admins and coaches can always switch to preview
  // either level: coaches evalúan ambos exámenes (Prospección y Objeciones),
  // así que no dependen de level2Unlocked para alternar niveles.
  const canSwitchLevel = isAdmin || isCoach || baseLevel === 2;
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

  const value = useMemo<LevelModeContextValue>(
    () => ({
      currentLevel,
      setLevel,
      toggle,
      isOverridden: override !== null,
      canSwitchLevel,
      resetOverride,
      lastChangeAt,
    }),
    [currentLevel, setLevel, toggle, override, canSwitchLevel, resetOverride, lastChangeAt],
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
