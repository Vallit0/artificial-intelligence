// ============================================
// Sede backfill seed
// ============================================
//
// Idempotente. Corre como parte del deploy después de aplicar el cambio
// de schema que agrega `Sede` y `User.sedeId` (todavía nullable a nivel
// DB). Hace dos cosas:
//
//   1. Crea la sede "Guatemala" si no existe (slug `guatemala`).
//      Asume que toda la base actual corresponde a esa sede.
//   2. Asigna esa sede a todo `User` con sede_id NULL.
//
// Una vez ejecutado en producción y verificado que no quedan users sin
// sede, se puede tightener la columna a NOT NULL con un ALTER manual:
//     ALTER TABLE users ALTER COLUMN sede_id SET NOT NULL;
// (No lo hacemos automáticamente para evitar romper el deploy si por
//  alguna razón el seed falló a medio camino.)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SEDE = {
  slug: 'guatemala',
  name: 'Guatemala',
  country: 'GT',
  city: 'Ciudad de Guatemala',
};

async function main() {
  const sede = await prisma.sede.upsert({
    where: { slug: DEFAULT_SEDE.slug },
    create: DEFAULT_SEDE,
    update: {},
  });
  console.log(`Sede default: ${sede.name} (${sede.id})`);

  const result = await prisma.user.updateMany({
    where: { sedeId: null },
    data: { sedeId: sede.id },
  });
  console.log(`Backfill: ${result.count} usuarios asignados a sede ${sede.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
