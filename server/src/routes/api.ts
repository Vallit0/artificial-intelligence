import { Router, Response } from 'express';
import db from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

export const apiRouter = Router();

// All API routes require authentication
apiRouter.use(authMiddleware);

// ============================================
// Scenarios
// ============================================

// GET /api/scenarios - List all active scenarios
apiRouter.get('/scenarios', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, name, description, objection, client_persona, 
              first_message, voice_type, difficulty, display_order
       FROM scenarios 
       WHERE is_active = true 
       ORDER BY display_order ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get scenarios error:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// GET /api/scenarios/:id - Get single scenario
apiRouter.get('/scenarios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM scenarios WHERE id = $1 AND is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get scenario error:', error);
    res.status(500).json({ error: 'Failed to fetch scenario' });
  }
});

// ============================================
// Practice Sessions
// ============================================

// GET /api/sessions - List user's practice sessions
apiRouter.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT ps.*, s.name as scenario_name
       FROM practice_sessions ps
       LEFT JOIN scenarios s ON ps.scenario_id = s.id
       WHERE ps.user_id = $1
       ORDER BY ps.created_at DESC
       LIMIT 100`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST /api/sessions - Create a new practice session
apiRouter.post('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { scenarioId, durationSeconds, score, passed, rating, aiFeedback } = req.body;

    const result = await db.query(
      `INSERT INTO practice_sessions 
        (user_id, scenario_id, duration_seconds, score, passed, rating, ai_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.id, scenarioId || null, durationSeconds || 0, score || null, passed || false, rating || null, aiFeedback || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PATCH /api/sessions/:id - Update a practice session
apiRouter.patch('/sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { durationSeconds, score, passed, rating, aiFeedback } = req.body;

    // Verify ownership
    const existing = await db.query(
      'SELECT id FROM practice_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
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
      [durationSeconds, score, passed, rating, aiFeedback, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// ============================================
// User Progress
// ============================================

// GET /api/progress - Get user's scenario progress
apiRouter.get('/progress', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT usp.*, s.name as scenario_name
       FROM user_scenario_progress usp
       JOIN scenarios s ON usp.scenario_id = s.id
       WHERE usp.user_id = $1
       ORDER BY s.display_order ASC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// POST /api/progress - Create or update progress
apiRouter.post('/progress', async (req: AuthRequest, res: Response) => {
  try {
    const { scenarioId, isUnlocked, isCompleted, bestScore, attempts } = req.body;

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
      [req.user!.id, scenarioId, isUnlocked || false, isCompleted || false, bestScore || null, attempts || 0]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ============================================
// User Stats
// ============================================

// GET /api/stats - Get user statistics
apiRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [sessionsResult, progressResult, streakResult] = await Promise.all([
      // Total sessions and time
      db.query(
        `SELECT 
          COUNT(*) as total_sessions,
          COALESCE(SUM(duration_seconds), 0) as total_time,
          COALESCE(AVG(score), 0) as avg_score
         FROM practice_sessions
         WHERE user_id = $1`,
        [req.user!.id]
      ),
      // Completed scenarios
      db.query(
        `SELECT COUNT(*) as completed_scenarios
         FROM user_scenario_progress
         WHERE user_id = $1 AND is_completed = true`,
        [req.user!.id]
      ),
      // Practice streak (days with at least one session)
      db.query(
        `SELECT COUNT(DISTINCT DATE(created_at)) as practice_days
         FROM practice_sessions
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [req.user!.id]
      ),
    ]);

    res.json({
      totalSessions: parseInt(sessionsResult.rows[0].total_sessions),
      totalTime: parseInt(sessionsResult.rows[0].total_time),
      avgScore: parseFloat(sessionsResult.rows[0].avg_score),
      completedScenarios: parseInt(progressResult.rows[0].completed_scenarios),
      practiceDays: parseInt(streakResult.rows[0].practice_days),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
