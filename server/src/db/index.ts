import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Test connection on startup
prisma.$connect()
  .then(() => console.log('✅ Database connected'))
  .catch((err: Error) => console.error('❌ Database connection failed:', err.message));

export default prisma;
