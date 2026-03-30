// ============================================
// Scenarios Service
// ============================================

import prisma from '../db/index.js';
import { Scenario } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';

// ============================================
// Scenario Operations
// ============================================

export async function getAllScenarios(): Promise<Scenario[]> {
  const scenarios = await prisma.scenario.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  return scenarios.map(mapToScenario);
}

export async function getScenarioById(id: string): Promise<Scenario> {
  const scenario = await prisma.scenario.findFirst({
    where: { id, isActive: true },
  });

  if (!scenario) {
    throw new NotFoundError('Scenario not found');
  }

  return mapToScenario(scenario);
}

export async function getScenarioForConversation(id: string): Promise<{
  clientPersona: string;
  firstMessage?: string;
  voiceType?: string;
} | null> {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { clientPersona: true, firstMessage: true, voiceType: true },
  });

  if (!scenario) return null;

  return {
    clientPersona: scenario.clientPersona,
    firstMessage: scenario.firstMessage || undefined,
    voiceType: scenario.voiceType || undefined,
  };
}

// ============================================
// Helper Functions
// ============================================

function mapToScenario(row: any): Scenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    objection: row.objection,
    clientPersona: row.clientPersona,
    firstMessage: row.firstMessage || undefined,
    voiceType: row.voiceType as 'male' | 'female',
    difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
    scriptContent: row.scriptContent as Record<string, unknown> | undefined,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
