// ============================================
// ElevenLabs Routes
// ============================================

import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import * as elevenlabsController from '../controllers/elevenlabs.controller.js';

export const elevenlabsRouter = Router();

/**
 * @openapi
 * /api/elevenlabs/conversation-token:
 *   post:
 *     tags: [ElevenLabs]
 *     summary: Devuelve un signed URL temporal para abrir la conversación con el agente
 *     security: []
 *     description: Acepta auth opcional (free-tier). El kill-switch global de IA bloquea esta ruta cuando está activado.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentSecretName: { type: string, example: ELEVENLABS_AGENT_COACH }
 *               scenarioId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: signedUrl (token firmado válido por minutos)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signedUrl: { type: string }
 *                 variantId: { type: string, nullable: true }
 *                 overrides: { type: object, nullable: true }
 *       403: { description: Acceso global a IA bloqueado }
 */
elevenlabsRouter.post('/conversation-token', optionalAuth, elevenlabsController.getConversationToken);

/**
 * @openapi
 * /api/elevenlabs/agent-evaluation:
 *   post:
 *     tags: [ElevenLabs]
 *     summary: Recibe la evaluación final que envía el agente desde la conversación
 *     description: Persiste el resultado en la sesión indicada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EvaluationResult'
 *               - type: object
 *                 required: [sessionId]
 *                 properties:
 *                   sessionId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Evaluación guardada }
 *       404: { description: Sesión no encontrada }
 */
elevenlabsRouter.post('/agent-evaluation', authMiddleware, elevenlabsController.saveAgentEvaluation);
