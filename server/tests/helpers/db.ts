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

/**
 * Crea una sede de test idempotente. Casi todos los tests necesitan AL
 * MENOS una sede activa porque signup/createUser exigen sede a nivel
 * aplicación (aunque sedeId sea nullable a nivel DB para tolerar
 * backfill). Devuelve el id+slug para que el test los use al hacer signup.
 */
export async function ensureTestSede(slug = 'test-sede', name = 'Test Sede'): Promise<{ id: string; slug: string; name: string }> {
  const sede = await prisma.sede.upsert({
    where: { slug },
    create: { slug, name },
    update: {},
  });
  return { id: sede.id, slug: sede.slug, name: sede.name };
}

export { prisma };
