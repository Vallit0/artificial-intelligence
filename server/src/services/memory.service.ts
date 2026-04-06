// ============================================
// Advisor Memory Service
// ============================================

import prisma from '../db/index.js';
import config from '../config/index.js';
import { MemoryCategory } from '../types/index.js';

// ============================================
// Retrieve Memories
// ============================================

export async function retrieveMemories(
  userId: string,
  category?: MemoryCategory,
  limit: number = 20
) {
  const where: any = { userId };
  if (category) {
    where.category = category;
  }

  const [memories, lastSummary] = await Promise.all([
    prisma.advisorMemory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    }),
    prisma.sessionSummary.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: { select: { name: true } },
      },
    }),
  ]);

  return {
    memories: memories.map(m => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      created_at: m.createdAt.toISOString(),
    })),
    last_session: lastSummary
      ? {
          summary: lastSummary.summary,
          score: lastSummary.score,
          scenario: lastSummary.scenario?.name || null,
          strengths: lastSummary.strengths,
          weaknesses: lastSummary.weaknesses,
          recommendation: lastSummary.recommendation,
          date: lastSummary.createdAt.toISOString(),
        }
      : null,
  };
}

// ============================================
// Save Memory
// ============================================

export async function saveMemory(
  userId: string,
  content: string,
  category: MemoryCategory,
  importance: number = 5,
  source: string = 'agent'
) {
  // Check for duplicate/similar content to avoid spamming
  const existing = await prisma.advisorMemory.findFirst({
    where: {
      userId,
      category,
      content: { contains: content.substring(0, 50) },
    },
  });

  if (existing) {
    // Update importance if the same pattern is detected again
    return prisma.advisorMemory.update({
      where: { id: existing.id },
      data: {
        importance: Math.min(10, existing.importance + 1),
        content, // refresh with latest wording
      },
    });
  }

  return prisma.advisorMemory.create({
    data: {
      userId,
      content,
      category,
      importance: Math.max(1, Math.min(10, importance)),
      source,
    },
  });
}

// ============================================
// Generate Session Summary (post-evaluation)
// ============================================

export async function generateSessionSummary(
  sessionId: string,
  userId: string,
  transcript: Array<{ role: string; content: string }>,
  scenarioId?: string,
  evaluation?: { score: number; passed: boolean; feedback: string; breakdown?: Record<string, number> }
) {
  if (!config.openai.apiKey) {
    console.warn('OpenAI API key not configured, skipping session summary');
    return null;
  }

  // Get scenario context
  let scenarioName = '';
  if (scenarioId) {
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { name: true, objection: true },
    });
    if (scenario) {
      scenarioName = scenario.name;
    }
  }

  const transcriptText = transcript
    .map(m => `${m.role === 'user' ? 'Vendedor' : 'Cliente'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `Eres un analista de desempeño de ventas para Corporación Señoriales.
Analiza esta transcripción de práctica de ventas y genera un resumen estructurado.

Responde EXCLUSIVAMENTE en JSON válido con esta estructura:
{
  "summary": "<resumen de 2-3 oraciones de cómo fue la conversación>",
  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],
  "weaknesses": ["<debilidad 1>", "<debilidad 2>"],
  "recommendation": "<qué debería practicar en su próxima sesión>",
  "notable_patterns": [
    {
      "content": "<descripción del patrón o comportamiento detectado>",
      "category": "<debilidad|fortaleza|expresion|comportamiento|progreso>",
      "importance": <1-10>
    }
  ]
}

Sé específico. Cita frases exactas del vendedor si detectas muletillas o expresiones problemáticas.
${scenarioName ? `Escenario practicado: ${scenarioName}` : ''}
${evaluation ? `Score: ${evaluation.score}/100. ${evaluation.feedback}` : ''}`;

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
          { role: 'user', content: `Transcripción:\n\n${transcriptText}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI summary error:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content);

    // Get session duration
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      select: { durationSeconds: true },
    });

    // Save session summary
    const summary = await prisma.sessionSummary.create({
      data: {
        userId,
        sessionId,
        scenarioId: scenarioId || null,
        summary: result.summary,
        score: evaluation?.score || null,
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        recommendation: result.recommendation || null,
        durationSeconds: session?.durationSeconds || 0,
      },
    });

    // Extract notable patterns as new advisor memories
    if (result.notable_patterns?.length) {
      await Promise.all(
        result.notable_patterns.map((pattern: any) =>
          saveMemory(
            userId,
            pattern.content,
            pattern.category,
            pattern.importance || 5,
            'summary'
          )
        )
      );
    }

    return summary;
  } catch (error) {
    console.error('Session summary generation error:', error);
    return null;
  }
}

// ============================================
// Build Context for Agent Override
// ============================================

export async function buildAgentContext(userId: string): Promise<string> {
  const { memories, last_session } = await retrieveMemories(userId);

  if (!memories.length && !last_session) {
    return '';
  }

  const parts: string[] = [];

  if (memories.length) {
    const weaknesses = memories.filter(m => m.category === 'debilidad');
    const strengths = memories.filter(m => m.category === 'fortaleza');
    const expressions = memories.filter(m => m.category === 'expresion');
    const behaviors = memories.filter(m => m.category === 'comportamiento');

    if (weaknesses.length) {
      parts.push(`DEBILIDADES CONOCIDAS DEL ASESOR:\n${weaknesses.map(m => `- ${m.content}`).join('\n')}`);
    }
    if (strengths.length) {
      parts.push(`FORTALEZAS DEL ASESOR:\n${strengths.map(m => `- ${m.content}`).join('\n')}`);
    }
    if (expressions.length) {
      parts.push(`EXPRESIONES/MULETILLAS DETECTADAS:\n${expressions.map(m => `- ${m.content}`).join('\n')}`);
    }
    if (behaviors.length) {
      parts.push(`PATRONES DE COMPORTAMIENTO:\n${behaviors.map(m => `- ${m.content}`).join('\n')}`);
    }
  }

  if (last_session) {
    parts.push(`ÚLTIMA SESIÓN (${last_session.scenario || 'práctica general'}, score: ${last_session.score || 'N/A'}):\n${last_session.summary}\nRecomendación: ${last_session.recommendation || 'Continuar practicando'}`);
  }

  return parts.join('\n\n');
}
