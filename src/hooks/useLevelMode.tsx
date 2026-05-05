import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "./useAuth";

export type Level = 1 | 2;

interface LevelModeContextValue {
  currentLevel: Level;
  // True only for admins. Sets a local override that persists in localStorage.
  // For non-admins this is a no-op — their level is bound to user.level2Unlocked.
  setLevel: (level: Level) => void;
  toggle: () => void;
  // True when the admin has manually overridden their level (so we know the
  // toggle has been used and the displayed level isn't just derived from the
  // unlock flag).
  isOverridden: boolean;
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
  const { user, isAdmin } = useAuth();
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
  const currentLevel: Level = isAdmin && override !== null ? override : baseLevel;

  // When the underlying baseLevel flips (e.g., student passes the exam), bump
  // the timestamp so the navbar animates the transition. We also drop a stale
  // admin override on the 1→2 transition: an admin who toggled to Level 1 to
  // test the exam flow expects the sidebar to actually advance after passing,
  // not stay pinned to the old override.
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
      if (!isAdmin) return;
      setOverride(level);
      writeOverride(level);
      setLastChangeAt(Date.now());
    },
    [isAdmin],
  );

  const toggle = useCallback(() => {
    if (!isAdmin) return;
    const next: Level = currentLevel === 1 ? 2 : 1;
    setOverride(next);
    writeOverride(next);
    setLastChangeAt(Date.now());
  }, [isAdmin, currentLevel]);

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
      resetOverride,
      lastChangeAt,
    }),
    [currentLevel, setLevel, toggle, override, resetOverride, lastChangeAt],
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
