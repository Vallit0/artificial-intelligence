// ============================================
// AI Access Service
// ============================================
// In-memory kill-switch that blocks ElevenLabs conversation
// tokens for every user except admins. Defaults to unlocked on
// server restart (safer default after a deploy).
//
// Admins can toggle it from the Admin panel before/after demos.

let aiLocked = false;
let lockedReason: string | null = null;
let lockedAt: number | null = null;

export function isAiLocked(): boolean {
  return aiLocked;
}

export function getLockStatus(): { locked: boolean; reason: string | null; lockedAt: number | null } {
  return { locked: aiLocked, reason: lockedReason, lockedAt };
}

export function setAiLocked(locked: boolean, reason?: string | null): void {
  aiLocked = !!locked;
  lockedReason = locked ? (reason || null) : null;
  lockedAt = locked ? Date.now() : null;
}
