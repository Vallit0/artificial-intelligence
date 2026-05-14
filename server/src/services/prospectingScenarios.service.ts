// ============================================
// Prospecting Scenarios Service
// ============================================

import prisma from '../db/index.js';
import { NotFoundError } from '../utils/errors.js';

export async function getAllConfigs() {
  return prisma.prospectingScenarioConfig.findMany({
    orderBy: { secretName: 'asc' },
  });
}

export async function upsertConfig(
  secretName: string,
  data: { label?: string; systemPrompt?: string; firstMessage?: string; isActiveGlobal?: boolean; builderParams?: unknown }
) {
  return prisma.prospectingScenarioConfig.upsert({
    where: { secretName },
    create: {
      secretName,
      label: data.label ?? null,
      systemPrompt: data.systemPrompt ?? null,
      firstMessage: data.firstMessage ?? null,
      isActiveGlobal: data.isActiveGlobal ?? true,
      builderParams: (data.builderParams as any) ?? undefined,
    },
    update: {
      label: data.label ?? undefined,
      systemPrompt: data.systemPrompt ?? undefined,
      firstMessage: data.firstMessage ?? undefined,
      isActiveGlobal: data.isActiveGlobal ?? undefined,
      builderParams: data.builderParams !== undefined ? (data.builderParams as any) : undefined,
    },
  });
}

export async function resolveConfig(secretName: string) {
  return prisma.prospectingScenarioConfig.findUnique({
    where: { secretName },
  });
}

// User access management
export async function getUserAccess(userId: string) {
  return prisma.userScenarioAccess.findMany({
    where: { userId },
  });
}

export async function setUserAccess(userId: string, secretName: string, enabled: boolean) {
  return prisma.userScenarioAccess.upsert({
    where: { userId_secretName: { userId, secretName } },
    create: { userId, secretName, enabled },
    update: { enabled },
  });
}

export async function bulkSetUserAccess(
  userId: string,
  entries: Array<{ secretName: string; enabled: boolean }>
) {
  return prisma.$transaction(
    entries.map((e) =>
      prisma.userScenarioAccess.upsert({
        where: { userId_secretName: { userId, secretName: e.secretName } },
        create: { userId, secretName: e.secretName, enabled: e.enabled },
        update: { enabled: e.enabled },
      })
    )
  );
}

// Resolve visibility for a user: per-user override takes precedence over global.
export async function isVisibleForUser(userId: string, secretName: string): Promise<boolean> {
  const userAccess = await prisma.userScenarioAccess.findUnique({
    where: { userId_secretName: { userId, secretName } },
  });
  if (userAccess) return userAccess.enabled;

  const cfg = await prisma.prospectingScenarioConfig.findUnique({
    where: { secretName },
    select: { isActiveGlobal: true },
  });
  return cfg?.isActiveGlobal ?? true;
}

export async function getVisibleSecretNamesForUser(userId: string): Promise<string[]> {
  const [configs, userOverrides] = await Promise.all([
    prisma.prospectingScenarioConfig.findMany({ select: { secretName: true, isActiveGlobal: true } }),
    prisma.userScenarioAccess.findMany({ where: { userId } }),
  ]);

  const overrideMap = new Map(userOverrides.map((o) => [o.secretName, o.enabled]));
  const visibleFromDb = new Set<string>();

  for (const cfg of configs) {
    const override = overrideMap.get(cfg.secretName);
    const visible = override !== undefined ? override : cfg.isActiveGlobal;
    if (visible) visibleFromDb.add(cfg.secretName);
  }

  // User overrides that exist without a config row: honor them if enabled
  for (const [secretName, enabled] of overrideMap.entries()) {
    if (enabled) visibleFromDb.add(secretName);
  }

  return Array.from(visibleFromDb);
}
