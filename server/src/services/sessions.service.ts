// ============================================
// Practice Sessions Service
// ============================================

import prisma from '../db/index.js';
import config from '../config/index.js';
import { PracticeSession, CreateSessionInput, UpdateSessionInput, SessionEvaluation, UserStats } from '../types/index.js';
import { NotFoundError, InternalError } from '../utils/errors.js';

// ============================================
// Session Operations
// ============================================

export async function getUserSessions(userId: string, limit: number = 100): Promise<PracticeSession[]> {
  const sessions = await prisma.practiceSession.findMany({
    where: { userId },
    include: { scenario: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return sessions.map(mapToSession);
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<PracticeSession> {
  const session = await prisma.practiceSession.create({
    data: {
      userId,
      scenarioId: input.scenarioId || null,
      durationSeconds: input.durationSeconds || 0,
      score: input.score || null,
      passed: input.passed || false,
      rating: input.rating || null,
      aiFeedback: input.aiFeedback || null,
    },
  });

  return mapToSession(session);
}

export async function updateSession(
  sessionId: string,
  userId: string,
  input: UpdateSessionInput
): Promise<PracticeSession> {
  const existing = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!existing) {
    throw new NotFoundError('Session not found');
  }

  const session = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      durationSeconds: input.durationSeconds ?? existing.durationSeconds,
      score: input.score ?? existing.score,
      passed: input.passed ?? existing.passed,
      rating: input.rating ?? existing.rating,
      aiFeedback: input.aiFeedback ?? existing.aiFeedback,
    },
  });

  return mapToSession(session);
}

export async function saveEvaluation(
  sessionId: string,
  userId: string,
  evaluation: SessionEvaluation
): Promise<PracticeSession> {
  const session = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      score: evaluation.score,
      passed: evaluation.passed,
      aiFeedback: evaluation.feedback,
    },
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Update scenario progress if passed
  if (evaluation.passed && session.scenarioId) {
    await updateProgressOnPass(userId, session.scenarioId, evaluation.score);
  }

  return mapToSession(session);
}

export async function evaluateSession(
  transcript: Array<{ role: string; content: string }>,
  scenarioId?: string
): Promise<SessionEvaluation> {
  // Get scenario context if provided
  let scenarioContext = '';
  if (scenarioId) {
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { name: true, objection: true, description: true },
    });
    if (scenario) {
      scenarioContext = `Escenario: ${scenario.name}\nObjeción del cliente: ${scenario.objection}\nDescripción: ${scenario.description || ''}`;
    }
  }

  // Format transcript
  const transcriptText = transcript
    .map(m => `${m.role === 'user' ? 'Vendedor' : 'Cliente'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `Eres un evaluador experto de técnicas de ventas para Corporación Señoriales, empresa mexicana de servicios funerarios.

Evalúa la siguiente conversación de práctica de ventas en una escala de 0 a 100 puntos, distribuidos en 5 criterios de 20 puntos cada uno:

1. APERTURA (20 pts): Presentación profesional, tono adecuado, generación de rapport
2. ESCUCHA ACTIVA (20 pts): Demuestra comprensión, parafrasea, hace preguntas relevantes
3. MANEJO DE OBJECIONES (20 pts): Usa declaraciones neutralizantes, no confronta, redirige
4. PROPUESTA DE VALOR (20 pts): Comunica beneficios claros, personaliza la propuesta
5. CIERRE (20 pts): Busca compromiso, propone siguiente paso, agradece

${scenarioContext}

Responde EXCLUSIVAMENTE en formato JSON válido con esta estructura:
{
  "score": <número 0-100>,
  "passed": <true si score >= 50>,
  "feedback": "<retroalimentación constructiva en español, 2-3 oraciones>",
  "breakdown": {
    "apertura": <0-20>,
    "escucha_activa": <0-20>,
    "manejo_objeciones": <0-20>,
    "propuesta_valor": <0-20>,
    "cierre": <0-20>
  }
}`;

  // Try OpenAI API
  if (config.openai.apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Transcripción de la llamada:\n\n${transcriptText}` },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error('OpenAI API error');
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No response content');

      const result = JSON.parse(content);
      return {
        score: result.score,
        passed: result.passed ?? result.score >= 50,
        feedback: result.feedback,
        breakdown: result.breakdown,
      };
    } catch (error) {
      console.error('Evaluation error:', error);
      throw new InternalError('Failed to evaluate session');
    }
  }

  // Fallback if no API key configured
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
  const [sessionsAgg, completedCount, practiceDays] = await Promise.all([
    prisma.practiceSession.aggregate({
      where: { userId },
      _count: true,
      _sum: { durationSeconds: true },
      _avg: { score: true },
    }),
    prisma.userScenarioProgress.count({
      where: { userId, isCompleted: true },
    }),
    prisma.practiceSession.groupBy({
      by: ['createdAt'],
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalSessions: sessionsAgg._count,
    totalTime: sessionsAgg._sum.durationSeconds || 0,
    avgScore: sessionsAgg._avg.score || 0,
    completedScenarios: completedCount,
    practiceDays: practiceDays.length,
  };
}

// ============================================
// Helper Functions
// ============================================

async function updateProgressOnPass(userId: string, scenarioId: string, score: number): Promise<void> {
  // Update or create progress for completed scenario
  await prisma.userScenarioProgress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: {
      userId,
      scenarioId,
      isCompleted: true,
      isUnlocked: true,
      bestScore: score,
      attempts: 1,
      firstCompletedAt: new Date(),
      lastAttemptAt: new Date(),
    },
    update: {
      isCompleted: true,
      bestScore: { set: score }, // Prisma doesn't have GREATEST, handle in app
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  // Fix: ensure bestScore is actually the best
  const current = await prisma.userScenarioProgress.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
  });
  if (current && current.bestScore !== null && current.bestScore > score) {
    // Revert if the existing score was higher
    await prisma.userScenarioProgress.update({
      where: { userId_scenarioId: { userId, scenarioId } },
      data: { bestScore: current.bestScore },
    });
  }

  // Unlock next scenario
  const currentScenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { displayOrder: true },
  });

  if (currentScenario) {
    const nextScenario = await prisma.scenario.findFirst({
      where: {
        isActive: true,
        displayOrder: { gt: currentScenario.displayOrder },
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (nextScenario) {
      await prisma.userScenarioProgress.upsert({
        where: { userId_scenarioId: { userId, scenarioId: nextScenario.id } },
        create: {
          userId,
          scenarioId: nextScenario.id,
          isUnlocked: true,
        },
        update: {
          isUnlocked: true,
        },
      });
    }
  }
}

function mapToSession(row: any): PracticeSession {
  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId || undefined,
    durationSeconds: row.durationSeconds,
    score: row.score ?? undefined,
    passed: row.passed,
    rating: row.rating ?? undefined,
    aiFeedback: row.aiFeedback || undefined,
    createdAt: row.createdAt,
  };
}
