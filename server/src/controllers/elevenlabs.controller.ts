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
import * as appConfigService from '../services/appConfig.service.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';
import prisma from '../db/index.js';

// País (ISO2) del usuario = país de su sede. null para anónimos (free-tier),
// usuarios sin sede o sedes sin país → se enruta al agente base.
async function resolveUserCountry(req: AuthRequest): Promise<string | null> {
  const sedeId = req.user?.sedeId;
  if (!sedeId) return null;
  try {
    const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { country: true } });
    return sede?.country?.trim().toUpperCase() || null;
  } catch (err) {
    getLogger({ component: 'elevenlabs', op: 'resolve-country' }).warn(
      { err, sedeId },
      'No se pudo resolver el país de la sede; se usa el agente base',
    );
    return null;
  }
}

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

    // Enrutamiento por país: el agente (y sus overrides/A-B) dependen del país
    // de la sede del usuario. Es una query puntual a Postgres (~ms) que debe
    // resolverse ANTES del signed URL porque define a qué agente conectamos.
    const country = await resolveUserCountry(req);

    // Primero se resuelve el agente efectivo (lookups rápidos en Postgres):
    // los overrides y el experimento A/B se buscan por el secret name EFECTIVO
    // (con sufijo de país si se enrutó a una variante). Si no, al agente de MX
    // se le inyectaría el prompt del agente base y hablaría "a la guatemalteca".
    const { agentId, effectiveSecretName, countryRouted } = await elevenlabsService.resolveAgent(
      agentSecretName,
      country,
    );

    // Overrides: para una variante por país se busca SÓLO su propia config
    // (`<SECRET>_MX`); no se hereda la del base. Para el base, como siempre.
    const overridesKey = agentSecretName ? (effectiveSecretName ?? agentSecretName) : null;

    // Run the independent lookups in parallel — the signed-URL fetch hits ElevenLabs
    // while the DB queries hit Postgres, so total latency is max() instead of sum().
    const userId = req.user?.id;
    const [signedUrl, scenarioData, prospectingCfg, abAssignment, language] = await Promise.all([
      elevenlabsService.getSignedUrlForAgentId(agentId),
      scenarioId
        ? scenariosService.getScenarioForConversation(scenarioId)
        : Promise.resolve(null),
      overridesKey
        ? prospectingScenariosService.resolveConfig(overridesKey)
        : Promise.resolve(null),
      (overridesKey && userId)
        ? abTestingService
            .findActiveExperiment(overridesKey)
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
      // Idioma global de los agentes (AppConfig). El cliente lo traduce al
      // override `agent.language` al iniciar la sesión; si falla la lectura se
      // cae al default ('es' = sin override) para no bloquear la práctica.
      appConfigService.getAgentLanguage().catch((err) => {
        getLogger({ component: 'elevenlabs', op: 'agent-language' }).warn(
          { err },
          'No se pudo leer el idioma de agentes; se usa el default',
        );
        return appConfigService.DEFAULT_AGENT_LANGUAGE;
      }),
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
        country,
        effectiveSecretName,
        countryRouted,
        scenarioId: scenarioId ?? null,
        promptOverrideApplied: !!overrides?.prompt,
        promptOverrideLen: overrides?.prompt?.length ?? 0,
        firstMessageOverrideApplied: !!overrides?.firstMessage,
        variantId: variantId ?? null,
        language,
      },
      'conversation token issued',
    );

    res.json({
      signedUrl,
      scenario,
      overrides,
      variantId,
      // Idioma en que debe hablar el agente ('es' | 'en'). 'es' = sin override.
      language,
      // Diagnóstico para el cliente/QA: a qué agente se enrutó y por qué país.
      routing: { country, agentSecretName: agentSecretName ?? null, effectiveSecretName, countryRouted },
    });
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

    // El passed autoritativo lo decide saveEvaluation según el examType de la
    // sesión (Objeciones=80, Prospección=75). El passed que mandamos aquí es
    // provisional; la respuesta refleja el valor recomputado y persistido.
    const saved = await sessionsService.saveEvaluation(sessionId, req.user!.id, {
      score,
      passed: score >= PASS_THRESHOLD,
      feedback,
      breakdown,
    });

    res.json({ success: true, evaluation: { score, passed: saved.passed, feedback, breakdown } });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
}
