// ============================================
// Authentication Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleError, BadRequestError, NotFoundError, InternalError } from '../utils/errors.js';
import prisma from '../db/index.js';
import config from '../config/index.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

export const authRouter = Router();

// Public routes
authRouter.post('/signup', authController.signup);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

// Protected routes
authRouter.get('/me', authMiddleware, authController.getMe);

// ============================================
// POST /auth/forgot-password
// ============================================
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestError('Email es requerido');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Always return success for security (don't reveal if user exists)
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (user) {
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing tokens
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Store new token
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      // Send email
      const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(cleanEmail, resetUrl);
      } catch (err) {
        console.error('Failed to send reset email:', err);
      }
    }

    res.json({ success: true, message: 'Si el email existe, recibirás instrucciones' });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /auth/reset-password
// ============================================
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new BadRequestError('Token y contraseña son requeridos');
    }
    if (password.length < 6) {
      throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestError('Token inválido o expirado');
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId: resetToken.userId },
    });

    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /auth/update-password (authenticated)
// ============================================
authRouter.post('/update-password', authMiddleware, async (req: any, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
