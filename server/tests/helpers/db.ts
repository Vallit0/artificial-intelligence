import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Trunca todas las tablas de la DB de test preservando el schema.
 * Usar en beforeEach para aislar casos.
 */
export async function resetDatabase(): Promise<void> {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;

  const tables = tablenames
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');

  if (tables.length === 0) return;

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}

export { prisma };
