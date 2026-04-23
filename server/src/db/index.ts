import { PrismaClient } from '@prisma/client';
import { rootLogger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Test connection on startup
prisma.$connect()
  .then(() => rootLogger.info('Database connected'))
  .catch((err: Error) => rootLogger.error({ err }, 'Database connection failed'));

export default prisma;
