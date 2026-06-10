// ============================================
// ElevenLabs Controller
// ============================================

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as elevenlabsService from '../services/elevenlabs.service.js';
import * as scenariosService from '../services/scenarios.service.js';
import * as sessionsService from '../services/sessions.service.js';
import * as prospectingScenariosService from '../services/prospectingScenarios.service.js';
import * as abTestingService from '../services/abTesting.service.js';
import * as aiAccessService from '../services/aiAccess.service.js';
import * as authService from '../services/auth.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

// Server-side recomputation: even though the agent sends score+passed, we
// ignore them and derive everything from the validated breakdown so the client
// cannot self-assign a passing grade by editing the body before forwarding.
const PASS_THRESHOLD = 75;

const agentEvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().min(1).max(2000),
  breakdown: z.object({
    apertura: z.number().min(0).max(20),
    escucha_activa: z.number().min(0).max(20),
    manejo_objeciones: z.number().min(0).max(20),
    propuesta_valor: z.number().min(0).max(20),
    cierre: z.number().min(0).max(20),
  }),
});

// ============================================
// POST /api/elevenlabs/conversation-token
// ============================================
export async function getConversationToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scenarioId, agentSecretName } = req.body;

    // Global AI kill-switch: block everyone except admins while enabled.
    if (aiAccessService.isAiLocked()) {
      const isAdmin = req.user ? await authService.hasRole(req.user.id, 'admin') : false;
      if (!isAdmin) {
        const { reason } = aiAccessService.getLockStatus();
        throw new ForbiddenError(reason || 'La practica con IA esta temporalmente deshabilitada.');
      }
    }

    // Run the four independent lookups in parallel — the signed-URL fetch hits ElevenLabs
    // while the DB queries hit Postgres, so total latency is now max() instead of sum().
    const userId = req.user?.id;
    const [signedUrl, scenarioData, prospectingCfg, abAssignment] = await Promise.all([
      elevenlabsService.getConversationSignedUrl(agentSecretName),
      scenarioId
        ? scenariosService.getScenarioForConversation(scenarioId)
        : Promise.resolve(null),
      agentSecretName
        ? prospectingScenariosService.resolveConfig(agentSecretName)
        : Promise.resolve(null),
      (agentSecretName && userId)
        ? abTestingService
            .findActiveExperiment(agentSecretName)
            .then((experiment) =>
              experiment
                ? abTestingService
                    .assignUserToVariant(experiment.id, userId)
                    .then((variant) => ({ variant, variantId: variant.id }))
                : null
            )
            .catch((err) => {
              getLogger({ component: 'elevenlabs', op: 'ab-assignment' }).warn(
                { err },
                'A/B assignment error (non-fatal)',
              );
              return null;
            })
        : Promise.resolve(null),
    ]);

    const scenario = scenarioData
      ? { prompt: scenarioData.clientPersona, firstMessage: scenarioData.firstMessage }
      : null;

    let overrides: { prompt?: string; firstMessage?: string } | null = null;
    if (prospectingCfg && (prospectingCfg.systemPrompt || prospectingCfg.firstMessage)) {
      overrides = {
        prompt: prospectingCfg.systemPrompt || undefined,
        firstMessage: prospectingCfg.firstMessage || undefined,
      };
    }

    let variantId: string | undefined;
    if (abAssignment) {
      variantId = abAssignment.variantId;
      const { variant } = abAssignment;
      // A/B variant overrides take precedence
      if (variant.systemPrompt || variant.firstMessage) {
        overrides = {
          prompt: variant.systemPrompt || overrides?.prompt,
          firstMessage: variant.firstMessage || overrides?.firstMessage,
        };
      }
    }

    // Diagnostic: the override prompt is resolved by the REQUESTED secretName,
    // independently of which agentId resolveAgentId() ended up routing to. Cross
    // this against the 'resolve-agent' log to spot prompt-injected-on-wrong-agent.
    getLogger({ component: 'elevenlabs', op: 'conversation-token' }).info(
      {
        agentSecretName: agentSecretName ?? null,
        scenarioId: scenarioId ?? null,
        promptOverrideApplied: !!overrides?.prompt,
        promptOverrideLen: overrides?.prompt?.length ?? 0,
        firstMessageOverrideApplied: !!overrides?.firstMessage,
        variantId: variantId ?? null,
      },
      'conversation token issued',
    );

    res.json({ signedUrl, scenario, overrides, variantId });
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
    const parsed = agentEvaluationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Evaluación inválida: se requieren sessionId, feedback y breakdown con los 5 rubros (0-20)');
    }

    const { sessionId, feedback, breakdown } = parsed.data;
    const score = Math.round(
      breakdown.apertura +
      breakdown.escucha_activa +
      breakdown.manejo_objeciones +
      breakdown.propuesta_valor +
      breakdown.cierre,
    );
    const passed = score >= PASS_THRESHOLD;

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
