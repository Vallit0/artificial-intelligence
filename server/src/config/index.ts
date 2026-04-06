// ============================================
// Server Configuration
// ============================================

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // URLs
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',  // Supports comma-separated origins: "http://localhost:5173,http://localhost:8080"
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/senoriales',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  jwtAccessExpiry: '1h',
  jwtRefreshExpiry: '7d',
  refreshTokenDays: 7,
  
  // ElevenLabs
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    agentId: process.env.ELEVENLABS_AGENT_ID || '',
    agentProspectingPareja: process.env.ELEVENLABS_AGENT_PROSPECTING_PAREJA || '',
    agentProspectingFrutas: process.env.ELEVENLABS_AGENT_PROSPECTING_FRUTAS || '',
    agentProspectingNeumaticos: process.env.ELEVENLABS_AGENT_PROSPECTING_NEUMATICOS || '',
    agentProspectingRestaurante: process.env.ELEVENLABS_AGENT_PROSPECTING_RESTAURANTE || '',
    agentProspectingParqueo: process.env.ELEVENLABS_AGENT_PROSPECTING_PARQUEO || '',
    agentExamenFinal: process.env.ELEVENLABS_AGENT_EXAMEN_FINAL || '',
    conversationUrl: 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url',
  },
  
  // OpenAI (optional, for session evaluation)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  // Resend (email service)
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'Señoriales <onboarding@resend.dev>',
} as const;

// Validation
export function validateConfig(): void {
  const required = ['jwtSecret'];
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing config: ${missing.join(', ')}`);
  }
  
  if (config.jwtSecret === 'change-this-in-production' && config.isProduction) {
    throw new Error('❌ JWT_SECRET must be set in production');
  }
  
  if (!config.elevenlabs.apiKey) {
    console.warn('⚠️ ELEVENLABS_API_KEY not set - voice features disabled');
  }
}

export default config;
