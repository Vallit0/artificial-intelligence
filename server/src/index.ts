// ============================================
// Main Server Entry Point
// ============================================

// Sentry MUST be imported before anything else so its instrumentation hooks
// can wrap Express/Prisma/fetch as they load.
import { Sentry } from './instrument.js';

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
import prisma from './db/index.js';
import { AppError } from './utils/errors.js';
import { rootLogger, getLogger } from './utils/logger.js';
import { requestContextMiddleware, httpLogger } from './middleware/requestContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate configuration
validateConfig();

const app = express();

// ============================================
// Middleware
// ============================================

// Must run first so every downstream handler (including error handler) can
// emit logs correlated by requestId.
app.use(requestContextMiddleware);
app.use(httpLogger);

// Tag Sentry scope with requestId so exceptions and breadcrumbs correlate
// one-to-one with the structured log stream.
app.use((req, _res, next) => {
  const requestId = (req as express.Request & { requestId?: string }).requestId;
  if (requestId) {
    Sentry.getCurrentScope().setTag('request_id', requestId);
  }
  next();
});

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
// Public Documents (always served — used by ElevenLabs agent tools)
// ============================================
const publicDocsPath = path.join(__dirname, '../../public/documents');
app.use('/documents', express.static(publicDocsPath, {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  },
}));

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

// Sentry's Express error handler must be registered AFTER all routes but
// BEFORE any user-defined error middleware. It reports exceptions with the
// full request context and then hands off to our handler for the response.
Sentry.setupExpressErrorHandler(app);

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const log = getLogger({ path: req.path, method: req.method });

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      log.error({ err, statusCode: err.statusCode }, 'AppError (server)');
    } else {
      log.warn({ err: { message: err.message }, statusCode: err.statusCode }, 'AppError (client)');
    }
    res.status(err.statusCode).json({ error: err.message });
  } else {
    log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Start Server
// ============================================

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    rootLogger.info(
      { port: config.port, environment: config.nodeEnv, appUrl: config.appUrl },
      'Señoriales server started',
    );
  });
}

export default app;
