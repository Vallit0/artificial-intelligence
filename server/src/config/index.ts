// ============================================
// Server Configuration — validated with zod
// ============================================
//
// Parses process.env at module load. In production, missing or malformed
// required values throw immediately with a clear message so the server
// fails fast instead of booting into a broken state.
//
// Optional agent IDs (ELEVENLABS_AGENT_PROSPECTING_*) are looked up
// dynamically by name in elevenlabs.service.ts, so they are not surfaced
// as individual fields on the config object — zod still validates them
// when present so a typo is caught at boot instead of at runtime.

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const optionalString = z.string().optional().default('');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
    .min(isProduction ? 32 : 1, isProduction
      ? 'JWT_SECRET must be at least 32 characters in production'
      : 'JWT_SECRET is required'),

  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_AGENT_ID: optionalString,
  ELEVENLABS_AGENT_COACH: optionalString,
  ELEVENLABS_AGENT_ROLEPLAY_CLIENTE: optionalString,
  ELEVENLABS_AGENT_ROLEPLAY_ASESOR: optionalString,
  ELEVENLABS_AGENT_COACH_NIVEL2: optionalString,
  ELEVENLABS_AGENT_ROLEPLAY_CLIENTE_NIVEL2: optionalString,
  ELEVENLABS_AGENT_ROLEPLAY_ASESOR_NIVEL2: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_PAREJA: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_FRUTAS: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_PARQUEO: optionalString,
  ELEVENLABS_AGENT_FAMILIA: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_CAMINANDO: optionalString,
  ELEVENLABS_AGENT_STAND1: optionalString,
  ELEVENLABS_AGENT_STAND2: optionalString,
  ELEVENLABS_AGENT_PROSPECTING_CEMENTERIO: optionalString,
  ELEVENLABS_AGENT_EXAMEN_FINAL: optionalString,

  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: z.string().default('Señoriales <onboarding@resend.dev>'),

  SENTRY_DSN: optionalString,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional(),
})
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.APP_URL.startsWith('http://') && !env.APP_URL.startsWith('http://localhost')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_URL'],
        message: 'APP_URL must use HTTPS in production',
      });
    }
    if (env.CORS_ORIGIN === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must be set to an explicit allowlist in production (not "*")',
      });
    }
    if (!env.ELEVENLABS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ELEVENLABS_API_KEY'],
        message: 'ELEVENLABS_API_KEY is required in production (voice features are core to the product)',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // Use console.error here — logger depends on config-free env vars only,
  // but we still want this readable before any log transport is configured.
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${issues}`);
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',

  appUrl: env.APP_URL,
  corsOrigin: env.CORS_ORIGIN,

  databaseUrl: env.DATABASE_URL,

  jwtSecret: env.JWT_SECRET,
  jwtAccessExpiry: '1h',
  jwtRefreshExpiry: '7d',
  refreshTokenDays: 7,

  elevenlabs: {
    apiKey: env.ELEVENLABS_API_KEY,
    agentId: env.ELEVENLABS_AGENT_ID,
    conversationUrl: 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url',
  },

  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  },

  resendApiKey: env.RESEND_API_KEY,
  resendFromEmail: env.RESEND_FROM_EMAIL,

  sentryDsn: env.SENTRY_DSN,
  logLevel: env.LOG_LEVEL,
} as const;

// Kept for backwards compatibility with src/index.ts; parsing already ran.
export function validateConfig(): void {
  // no-op: validation happens at import time.
}

export default config;
