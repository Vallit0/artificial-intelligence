import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes('senoriales_test')) {
    throw new Error(
      'Refusing to run tests: DATABASE_URL no apunta a la base de test. Verifica server/.env.test.'
    );
  }

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  });
}
