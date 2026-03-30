// ============================================
// ElevenLabs Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as elevenlabsService from '../services/elevenlabs.service.js';
import * as scenariosService from '../services/scenarios.service.js';
import * as sessionsService from '../services/sessions.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError } from '../utils/errors.js';

// ============================================
// POST /api/elevenlabs/conversation-token
// ============================================
export async function getConversationToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scenarioId, agentSecretName } = req.body;

    // Get signed URL (with optional custom agent)
    const signedUrl = await elevenlabsService.getConversationSignedUrl(agentSecretName);
    
    // Fetch scenario details if provided
    let scenario = null;
    if (scenarioId) {
      const scenarioData = await scenariosService.getScenarioForConversation(scenarioId);
      if (scenarioData) {
        scenario = {
          prompt: scenarioData.clientPersona,
          firstMessage: scenarioData.firstMessage,
        };
      }
    }
    
    res.json({ signedUrl, scenario });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/elevenlabs/scribe-token
// ============================================
export async function getScribeToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = await elevenlabsService.getScribeToken();
    res.json({ token });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}

// ============================================
// POST /api/elevenlabs/agent-evaluation
// ============================================
export async function saveAgentEvaluation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, score, passed, feedback, breakdown } = req.body;
    
    if (!sessionId) {
      throw new BadRequestError('Session ID required');
    }
    
    await sessionsService.saveEvaluation(sessionId, req.user!.id, {
      score,
      passed,
      feedback,
      breakdown,
    });
    
    res.json({ success: true, evaluation: { score, passed, feedback, breakdown } });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
