// ============================================
// Practice Sessions Service
// ============================================

import db from '../db/index.js';
import { PracticeSession, CreateSessionInput, UpdateSessionInput, SessionEvaluation, UserStats } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';

// ============================================
// Session Operations
// ============================================

export async function getUserSessions(userId: string, limit: number = 100): Promise<PracticeSession[]> {
  const result = await db.query(
    `SELECT ps.*, s.name as scenario_name
     FROM practice_sessions ps
     LEFT JOIN scenarios s ON ps.scenario_id = s.id
     WHERE ps.user_id = $1
     ORDER BY ps.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  
  return result.rows.map(mapRowToSession);
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<PracticeSession> {
  const result = await db.query(
    `INSERT INTO practice_sessions 
      (user_id, scenario_id, duration_seconds, score, passed, rating, ai_feedback)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      input.scenarioId || null,
      input.durationSeconds || 0,
      input.score || null,
      input.passed || false,
      input.rating || null,
      input.aiFeedback || null,
    ]
  );

  return mapRowToSession(result.rows[0]);
}

export async function updateSession(
  sessionId: string,
  userId: string,
  input: UpdateSessionInput
): Promise<PracticeSession> {
  // Verify ownership
  const existing = await db.query(
    'SELECT id FROM practice_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Session not found');
  }

  const result = await db.query(
    `UPDATE practice_sessions SET
      duration_seconds = COALESCE($1, duration_seconds),
      score = COALESCE($2, score),
      passed = COALESCE($3, passed),
      rating = COALESCE($4, rating),
      ai_feedback = COALESCE($5, ai_feedback)
     WHERE id = $6
     RETURNING *`,
    [
      input.durationSeconds,
      input.score,
      input.passed,
      input.rating,
      input.aiFeedback,
      sessionId,
    ]
  );

  return mapRowToSession(result.rows[0]);
}

export async function saveEvaluation(
  sessionId: string,
  userId: string,
  evaluation: SessionEvaluation
): Promise<PracticeSession> {
  const result = await db.query(
    `UPDATE practice_sessions 
     SET score = $2, passed = $3, ai_feedback = $4
     WHERE id = $1 AND user_id = $5
     RETURNING *`,
    [sessionId, evaluation.score, evaluation.passed, evaluation.feedback, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Session not found');
  }

  const session = result.rows[0];

  // Update scenario progress if passed
  if (evaluation.passed && session.scenario_id) {
    await updateProgressOnPass(userId, session.scenario_id, evaluation.score);
  }

  return mapRowToSession(session);
}

export async function evaluateSession(
  _transcript: Array<{ role: string; content: string }>,
  _scenarioId?: string
): Promise<SessionEvaluation> {
  // TODO: Implement OpenAI/Gemini evaluation
  // For now, return a basic evaluation
  return {
    score: 75,
    passed: true,
    feedback: 'Buen trabajo en la práctica. Continúa mejorando tu técnica de manejo de objeciones.',
    breakdown: {
      apertura: 80,
      escucha_activa: 75,
      manejo_objeciones: 70,
      propuesta_valor: 75,
      cierre: 75,
    },
  };
}

// ============================================
// Statistics
// ============================================

export async function getUserStats(userId: string): Promise<UserStats> {
  const [sessionsResult, progressResult, streakResult] = await Promise.all([
    db.query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_seconds), 0) as total_time,
        COALESCE(AVG(score), 0) as avg_score
       FROM practice_sessions
       WHERE user_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*) as completed_scenarios
       FROM user_scenario_progress
       WHERE user_id = $1 AND is_completed = true`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as practice_days
       FROM practice_sessions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    ),
  ]);

  return {
    totalSessions: parseInt(sessionsResult.rows[0].total_sessions),
    totalTime: parseInt(sessionsResult.rows[0].total_time),
    avgScore: parseFloat(sessionsResult.rows[0].avg_score),
    completedScenarios: parseInt(progressResult.rows[0].completed_scenarios),
    practiceDays: parseInt(streakResult.rows[0].practice_days),
  };
}

// ============================================
// Helper Functions
// ============================================

async function updateProgressOnPass(userId: string, scenarioId: string, score: number): Promise<void> {
  // Update or create progress
  await db.query(
    `INSERT INTO user_scenario_progress (user_id, scenario_id, is_completed, best_score, attempts, is_unlocked, first_completed_at)
     VALUES ($1, $2, true, $3, 1, true, NOW())
     ON CONFLICT (user_id, scenario_id)
     DO UPDATE SET
       is_completed = true,
       best_score = GREATEST($3, COALESCE(user_scenario_progress.best_score, 0)),
       attempts = user_scenario_progress.attempts + 1,
       first_completed_at = COALESCE(user_scenario_progress.first_completed_at, NOW())`,
    [userId, scenarioId, score]
  );

  // Unlock next scenario
  await db.query(
    `INSERT INTO user_scenario_progress (user_id, scenario_id, is_unlocked)
     SELECT $1, s2.id, true
     FROM scenarios s1, scenarios s2
     WHERE s1.id = $2
       AND s2.display_order = s1.display_order + 1
       AND s2.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM user_scenario_progress
         WHERE user_id = $1 AND scenario_id = s2.id
       )
     ON CONFLICT (user_id, scenario_id) DO UPDATE SET is_unlocked = true`,
    [userId, scenarioId]
  );
}

function mapRowToSession(row: Record<string, unknown>): PracticeSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    scenarioId: row.scenario_id as string | undefined,
    durationSeconds: row.duration_seconds as number,
    score: row.score as number | undefined,
    passed: row.passed as boolean,
    rating: row.rating as number | undefined,
    aiFeedback: row.ai_feedback as string | undefined,
    createdAt: row.created_at as Date,
  };
}
