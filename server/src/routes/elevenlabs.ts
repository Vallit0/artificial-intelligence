import { Router, Response } from 'express';
import db from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

export const elevenlabsRouter = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// All ElevenLabs routes require authentication
elevenlabsRouter.use(authMiddleware);

// ============================================
// POST /api/elevenlabs/conversation-token
// Get signed URL for conversation
// ============================================
elevenlabsRouter.post('/conversation-token', async (req: AuthRequest, res: Response) => {
  try {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      res.status(500).json({ error: 'ElevenLabs not configured' });
      return;
    }

    const { scenarioId } = req.body;

    // Fetch scenario if provided
    let scenario = null;
    if (scenarioId) {
      const scenarioResult = await db.query(
        'SELECT client_persona, first_message, voice_type FROM scenarios WHERE id = $1',
        [scenarioId]
      );
      if (scenarioResult.rows.length > 0) {
        scenario = scenarioResult.rows[0];
      }
    }

    // Get signed URL from ElevenLabs
    const tokenUrl = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`;

    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      res.status(500).json({ error: 'Failed to get conversation token' });
      return;
    }

    const data = await response.json();

    res.json({
      signedUrl: data.signed_url,
      scenario: scenario
        ? {
            prompt: scenario.client_persona,
            firstMessage: scenario.first_message,
          }
        : null,
    });
  } catch (error) {
    console.error('Conversation token error:', error);
    res.status(500).json({ error: 'Failed to get conversation token' });
  }
});

// ============================================
// POST /api/elevenlabs/scribe-token
// Get token for real-time transcription
// ============================================
elevenlabsRouter.post('/scribe-token', async (req: AuthRequest, res: Response) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      res.status(500).json({ error: 'ElevenLabs not configured' });
      return;
    }

    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs Scribe API error:', response.status, errorText);
      res.status(500).json({ error: 'Failed to get scribe token' });
      return;
    }

    const data = await response.json();

    res.json({ token: data.token });
  } catch (error) {
    console.error('Scribe token error:', error);
    res.status(500).json({ error: 'Failed to get scribe token' });
  }
});

// ============================================
// POST /api/elevenlabs/agent-evaluation
// Save evaluation from ElevenLabs agent
// ============================================
elevenlabsRouter.post('/agent-evaluation', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, score, passed, feedback, breakdown } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    // Update the practice session with evaluation
    const result = await db.query(
      `UPDATE practice_sessions
       SET score = $2, passed = $3, ai_feedback = $4
       WHERE id = $1 AND user_id = $5
       RETURNING *`,
      [sessionId, score, passed, feedback, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = result.rows[0];

    // Update scenario progress if passed
    if (passed && session.scenario_id) {
      await db.query(
        `INSERT INTO user_scenario_progress (user_id, scenario_id, is_completed, best_score, attempts, is_unlocked, first_completed_at)
         VALUES ($1, $2, true, $3, 1, true, NOW())
         ON CONFLICT (user_id, scenario_id)
         DO UPDATE SET
           is_completed = true,
           best_score = GREATEST($3, COALESCE(user_scenario_progress.best_score, 0)),
           attempts = user_scenario_progress.attempts + 1,
           first_completed_at = COALESCE(user_scenario_progress.first_completed_at, NOW())`,
        [req.user!.id, session.scenario_id, score]
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
        [req.user!.id, session.scenario_id]
      );
    }

    res.json({ success: true, evaluation: { score, passed, feedback, breakdown } });
  } catch (error) {
    console.error('Agent evaluation error:', error);
    res.status(500).json({ error: 'Failed to save evaluation' });
  }
});
