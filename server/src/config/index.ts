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
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
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
    conversationUrl: 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url',
    scribeUrl: 'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
  },
  
  // OpenAI (optional, for session evaluation)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
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
