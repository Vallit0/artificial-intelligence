// ============================================
// Authentication Routes
// ============================================

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

// Public routes
authRouter.post('/signup', authController.signup);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

// Protected routes
authRouter.get('/me', authMiddleware, authController.getMe);
