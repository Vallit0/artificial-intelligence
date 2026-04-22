// ============================================
// Advisor Memory Service
// ============================================

import prisma from '../db/index.js';
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
