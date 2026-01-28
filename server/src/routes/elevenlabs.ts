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
