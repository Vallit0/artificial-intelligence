// ============================================
// User Progress Service
// ============================================

import db from '../db/index.js';
import { UserProgress } from '../types/index.js';

// ============================================
// Progress Operations
// ============================================

export async function getUserProgress(userId: string): Promise<UserProgress[]> {
  const result = await db.query(
    `SELECT usp.*, s.name as scenario_name
     FROM user_scenario_progress usp
     JOIN scenarios s ON usp.scenario_id = s.id
     WHERE usp.user_id = $1
     ORDER BY s.display_order ASC`,
    [userId]
  );
  
  return result.rows.map(mapRowToProgress);
}

export async function upsertProgress(
  userId: string,
  scenarioId: string,
  input: {
    isUnlocked?: boolean;
    isCompleted?: boolean;
    bestScore?: number;
    attempts?: number;
  }
): Promise<UserProgress> {
  const result = await db.query(
    `INSERT INTO user_scenario_progress 
      (user_id, scenario_id, is_unlocked, is_completed, best_score, attempts)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, scenario_id) DO UPDATE SET
      is_unlocked = COALESCE(EXCLUDED.is_unlocked, user_scenario_progress.is_unlocked),
      is_completed = COALESCE(EXCLUDED.is_completed, user_scenario_progress.is_completed),
      best_score = GREATEST(EXCLUDED.best_score, user_scenario_progress.best_score),
      attempts = user_scenario_progress.attempts + 1,
      last_attempt_at = NOW(),
      first_completed_at = CASE 
        WHEN EXCLUDED.is_completed AND user_scenario_progress.first_completed_at IS NULL 
        THEN NOW() 
        ELSE user_scenario_progress.first_completed_at 
      END,
      updated_at = NOW()
     RETURNING *`,
    [
      userId,
      scenarioId,
      input.isUnlocked || false,
      input.isCompleted || false,
      input.bestScore || null,
      input.attempts || 0,
    ]
  );

  return mapRowToProgress(result.rows[0]);
}

export async function getScenarioProgress(userId: string, scenarioId: string): Promise<UserProgress | null> {
  const result = await db.query(
    `SELECT * FROM user_scenario_progress 
     WHERE user_id = $1 AND scenario_id = $2`,
    [userId, scenarioId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToProgress(result.rows[0]);
}

export async function unlockFirstScenario(userId: string): Promise<void> {
  await db.query(
    `INSERT INTO user_scenario_progress (user_id, scenario_id, is_unlocked)
     SELECT $1, id, true
     FROM scenarios
     WHERE is_active = true
     ORDER BY display_order ASC
     LIMIT 1
     ON CONFLICT (user_id, scenario_id) DO NOTHING`,
    [userId]
  );
}

// ============================================
// Helper Functions
// ============================================

function mapRowToProgress(row: Record<string, unknown>): UserProgress {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    scenarioId: row.scenario_id as string,
    isUnlocked: row.is_unlocked as boolean,
    isCompleted: row.is_completed as boolean,
    bestScore: row.best_score as number | undefined,
    attempts: row.attempts as number,
    firstCompletedAt: row.first_completed_at as Date | undefined,
    lastAttemptAt: row.last_attempt_at as Date | undefined,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
