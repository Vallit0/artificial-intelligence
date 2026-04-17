// ============================================
// A/B Testing Service
// ============================================

import prisma from '../db/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// ============================================
// CRUD
// ============================================

export async function getExperiments() {
  return prisma.abExperiment.findMany({
    include: {
      variants: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExperimentById(id: string) {
  const experiment = await prisma.abExperiment.findUnique({
    where: { id },
    include: {
      variants: true,
      assignments: { select: { id: true, userId: true, variantId: true } },
    },
  });
  if (!experiment) throw new NotFoundError('Experiment not found');
  return experiment;
}

export async function createExperiment(data: {
  name: string;
  description?: string;
  agentSecretName: string;
  variants: Array<{ name: string; systemPrompt?: string; firstMessage?: string; weight?: number }>;
}) {
  if (!data.variants || data.variants.length < 2) {
    throw new BadRequestError('At least 2 variants are required');
  }

  return prisma.abExperiment.create({
    data: {
      name: data.name,
      description: data.description,
      agentSecretName: data.agentSecretName,
      variants: {
        create: data.variants.map(v => ({
          name: v.name,
          systemPrompt: v.systemPrompt || null,
          firstMessage: v.firstMessage || null,
          weight: v.weight ?? 1,
        })),
      },
    },
    include: { variants: true },
  });
}

export async function updateExperiment(id: string, data: {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'completed';
}) {
  const existing = await prisma.abExperiment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Experiment not found');

  return prisma.abExperiment.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      status: data.status ?? existing.status,
    },
    include: { variants: true },
  });
}

export async function deleteExperiment(id: string) {
  await prisma.abExperiment.delete({ where: { id } });
}

// ============================================
// Variant Assignment
// ============================================

export async function assignUserToVariant(experimentId: string, userId: string) {
  // Check existing sticky assignment
  const existing = await prisma.abAssignment.findUnique({
    where: { experimentId_userId: { experimentId, userId } },
    include: { variant: true },
  });
  if (existing) return existing.variant;

  // Get variants with weights
  const variants = await prisma.abVariant.findMany({
    where: { experimentId },
  });

  if (variants.length === 0) {
    throw new BadRequestError('Experiment has no variants');
  }

  // Weighted random selection
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  let selected = variants[0];
  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      selected = variant;
      break;
    }
  }

  // Create sticky assignment
  await prisma.abAssignment.create({
    data: { experimentId, variantId: selected.id, userId },
  });

  return selected;
}

// ============================================
// Find active experiment for an agent
// ============================================

export async function findActiveExperiment(agentSecretName: string) {
  return prisma.abExperiment.findFirst({
    where: { agentSecretName, status: 'active' },
    include: { variants: true },
  });
}

// ============================================
// Results Aggregation
// ============================================

export async function getExperimentResults(experimentId: string) {
  const experiment = await prisma.abExperiment.findUnique({
    where: { id: experimentId },
    include: { variants: true },
  });

  if (!experiment) throw new NotFoundError('Experiment not found');

  const results = await Promise.all(
    experiment.variants.map(async (variant) => {
      const [sessionsAgg, passCount, breakdownAvg, assignmentCount] = await Promise.all([
        prisma.practiceSession.aggregate({
          where: { abVariantId: variant.id, score: { not: null } },
          _count: true,
          _avg: { score: true, durationSeconds: true },
        }),
        prisma.practiceSession.count({
          where: { abVariantId: variant.id, passed: true },
        }),
        prisma.evaluationBreakdown.aggregate({
          where: { session: { abVariantId: variant.id } },
          _avg: {
            apertura: true,
            escuchaActiva: true,
            manejoObjeciones: true,
            propuestaValor: true,
            cierre: true,
          },
        }),
        prisma.abAssignment.count({
          where: { variantId: variant.id },
        }),
      ]);

      return {
        variantId: variant.id,
        variantName: variant.name,
        assignmentCount,
        sessionCount: sessionsAgg._count,
        avgScore: sessionsAgg._avg.score ? Math.round(sessionsAgg._avg.score * 10) / 10 : null,
        avgDuration: sessionsAgg._avg.durationSeconds
          ? Math.round(sessionsAgg._avg.durationSeconds)
          : null,
        passRate: sessionsAgg._count > 0
          ? Math.round((passCount / sessionsAgg._count) * 100)
          : 0,
        breakdownAvg: breakdownAvg._avg,
      };
    })
  );

  return {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      agentSecretName: experiment.agentSecretName,
    },
    results,
  };
}
