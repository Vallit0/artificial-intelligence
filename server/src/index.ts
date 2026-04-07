// ============================================
// Main Server Entry Point
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { validateConfig } from './config/index.js';
import { authRouter } from './routes/auth.js';
import { ltiRouter } from './routes/lti.js';
import { apiRouter } from './routes/api.js';
import { elevenlabsRouter } from './routes/elevenlabs.js';
import { adminRouter } from './routes/admin.js';
import { memoryRouter } from './routes/memory.js';
import { citasRouter } from './routes/citas.js';
import { whatsappRouter } from './routes/whatsapp.js';
import prisma from './db/index.js';
import { AppError } from './utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate configuration
validateConfig();

const app = express();

// ============================================
// Middleware
// ============================================

app.use(helmet({
  contentSecurityPolicy: false, // Disable for SPA
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowed = config.corsOrigin.split(',').map(o => o.trim());
    if (allowed.includes('*') || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.text({ type: ['application/sdp', 'text/plain'] }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// Routes
// ============================================

// API Routes
app.use('/auth', authRouter);
app.use('/lti', ltiRouter);
app.use('/api/elevenlabs', elevenlabsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/citas', citasRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api', apiRouter);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      services: {
        database: 'connected',
        elevenlabs: config.elevenlabs.apiKey ? 'configured' : 'not configured',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
      },
    });
  }
});

// ============================================
// Static Files (Production)
// ============================================

if (config.isProduction) {
  const staticPath = path.join(__dirname, '../client/dist');

  // Cache PDFs and audio files aggressively (30 days)
  app.use('/assets', express.static(path.join(staticPath, 'assets'), {
    maxAge: '30d',
    immutable: true,
  }));
  app.use('/audio', express.static(path.join(staticPath, '../audio'), {
    maxAge: '30d',
  }));

  app.use(express.static(staticPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/lti')) {
      res.sendFile(path.join(staticPath, 'index.html'));
    }
  });
}

// ============================================
// Error Handler
// ============================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Start Server
// ============================================

app.listen(config.port, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     Señoriales - Sales Training Platform    ║
╠════════════════════════════════════════════╣
║  🚀 Server running on port ${config.port}             ║
║  📊 Environment: ${config.nodeEnv.padEnd(21)}║
║  🔗 URL: ${config.appUrl.padEnd(29)}║
╚════════════════════════════════════════════╝
  `);
});

export default app;
