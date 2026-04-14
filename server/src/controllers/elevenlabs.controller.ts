// ============================================
// ElevenLabs Controller
// ============================================

import { Response, NextFunction } from 'express';
import * as elevenlabsService from '../services/elevenlabs.service.js';
import * as scenariosService from '../services/scenarios.service.js';
import * as sessionsService from '../services/sessions.service.js';
import * as prospectingScenariosService from '../services/prospectingScenarios.service.js';
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

    // Resolve admin-configured overrides for prospecting agents (if any)
    let overrides: { prompt?: string; firstMessage?: string } | null = null;
    if (agentSecretName) {
      const cfg = await prospectingScenariosService.resolveConfig(agentSecretName);
      if (cfg && (cfg.systemPrompt || cfg.firstMessage)) {
        overrides = {
          prompt: cfg.systemPrompt || undefined,
          firstMessage: cfg.firstMessage || undefined,
        };
      }
    }

    res.json({ signedUrl, scenario, overrides });
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
