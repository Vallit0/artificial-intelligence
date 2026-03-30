// ============================================
// API Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as scenariosController from '../controllers/scenarios.controller.js';
import * as sessionsController from '../controllers/sessions.controller.js';
import * as progressController from '../controllers/progress.controller.js';
import config from '../config/index.js';
import { handleError, InternalError } from '../utils/errors.js';

export const apiRouter = Router();

// ============================================
// Public Routes
// ============================================

// Scenarios (public for listing)
apiRouter.get('/scenarios', scenariosController.getAll);
apiRouter.get('/scenarios/:id', scenariosController.getById);

// ============================================
// Realtime Session (OpenAI WebRTC proxy)
// ============================================
apiRouter.post('/realtime-session', async (req: Request, res: Response) => {
  try {
    if (!config.openai.apiKey) {
      throw new InternalError('OpenAI API key not configured');
    }

    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('application/sdp') && !contentType.includes('text/plain')) {
      res.status(400).json({ error: 'Invalid content type, expected application/sdp' });
      return;
    }

    // Get raw body as text
    let sdp: string;
    if (typeof req.body === 'string') {
      sdp = req.body;
    } else {
      sdp = JSON.stringify(req.body);
    }

    // Step 1: Get ephemeral token
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'shimmer',
        instructions: `Eres María González, una mujer de 52 años que vive en Guadalajara, Jalisco. Tu esposo Carlos falleció hace 3 meses y ahora estás considerando adquirir un plan funerario para ti y tu familia.

CONTEXTO PERSONAL:
- Tienes 2 hijos adultos (Roberto de 28 y Sofía de 25)
- Trabajas como contadora en una empresa mediana
- Tu ingreso mensual es de aproximadamente $25,000 pesos
- La experiencia reciente con los gastos funerarios de tu esposo (costó más de $80,000) te dejó preocupada
- Quieres evitar que tus hijos pasen por el mismo estrés financiero

COMPORTAMIENTO EN LA LLAMADA:
- Eres amable pero cautelosa con vendedores
- Haces preguntas sobre precios, qué incluye el servicio, formas de pago
- Tus objeciones principales son:
  * "Es mucho dinero de golpe"
  * "Necesito consultarlo con mis hijos"
  * "¿Y si la empresa cierra antes de que yo fallezca?"
  * "Déjeme pensarlo y le llamo después"
- Si el asesor maneja bien tus objeciones, puedes mostrar interés genuino
- Si el asesor es muy agresivo o no responde bien, te cierras

IMPORTANTE: Habla de manera natural, como una persona real. Usa expresiones coloquiales mexicanas.`,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session error:', sessionResponse.status, errorText);
      throw new InternalError('Failed to create realtime session');
    }

    const sessionData = await sessionResponse.json() as any;
    const ephemeralKey = sessionData.client_secret?.value;

    if (!ephemeralKey) {
      throw new InternalError('Failed to get ephemeral key');
    }

    // Step 2: Establish WebRTC connection
    const realtimeResponse = await fetch(
      'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: sdp,
      }
    );

    if (!realtimeResponse.ok) {
      const errorText = await realtimeResponse.text();
      console.error('OpenAI realtime error:', realtimeResponse.status, errorText);
      throw new InternalError('Failed to connect to realtime');
    }

    const answerSdp = await realtimeResponse.text();
    res.setHeader('Content-Type', 'application/sdp');
    res.send(answerSdp);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Protected Routes
// ============================================

apiRouter.use(authMiddleware);

// Practice Sessions
apiRouter.get('/sessions', sessionsController.getAll);
apiRouter.post('/sessions', sessionsController.create);
apiRouter.patch('/sessions/:id', sessionsController.update);
apiRouter.post('/sessions/evaluate', sessionsController.evaluate);

// User Progress
apiRouter.get('/progress', progressController.getProgress);
apiRouter.post('/progress', progressController.updateProgress);

// User Stats
apiRouter.get('/stats', sessionsController.getStats);
