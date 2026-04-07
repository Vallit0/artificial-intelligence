// ============================================
// Agent Config Service
// ============================================

import prisma from '../db/index.js';
import { NotFoundError } from '../utils/errors.js';

export async function getAll() {
  return prisma.agentConfig.findMany({
    orderBy: { secretName: 'asc' },
  });
}

export async function upsert(secretName: string, agentId: string, label?: string) {
  return prisma.agentConfig.upsert({
    where: { secretName },
    create: { secretName, agentId, label: label || null },
    update: { agentId, label: label || null },
  });
}

export async function remove(id: string) {
  const config = await prisma.agentConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError('Agent config not found');
  return prisma.agentConfig.delete({ where: { id } });
}

export async function resolve(secretName: string): Promise<string | null> {
  const config = await prisma.agentConfig.findUnique({
    where: { secretName },
    select: { agentId: true, isActive: true },
  });
  if (config?.isActive && config.agentId) {
    return config.agentId;
  }
  return null;
}
