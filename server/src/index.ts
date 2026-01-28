import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth.js';
import { ltiRouter } from './routes/lti.js';
import { apiRouter } from './routes/api.js';
import { elevenlabsRouter } from './routes/elevenlabs.js';
import { db } from './db/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for SPA
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/auth', authRouter);
app.use('/lti', ltiRouter);
app.use('/api', apiRouter);
app.use('/api/elevenlabs', elevenlabsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static React build in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(staticPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/lti')) {
      res.sendFile(path.join(staticPath, 'index.html'));
    }
  });
}

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
