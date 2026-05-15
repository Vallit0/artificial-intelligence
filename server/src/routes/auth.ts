// ============================================
// Authentication Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { hashPassword } from '../utils/passwordHash.js';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.js';
import { handleError, BadRequestError, NotFoundError, InternalError } from '../utils/errors.js';
import prisma from '../db/index.js';
import config from '../config/index.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { getLogger } from '../utils/logger.js';

export const authRouter = Router();

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Crea una cuenta nueva
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 4 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phoneNumber: { type: string }
 *     responses:
 *       201:
 *         description: Usuario creado y autenticado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokens' }
 *       400: { description: Email ya registrado o datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       429: { description: Demasiados intentos }
 */
authRouter.post('/signup', authLimiter, authController.signup);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión y devuelve tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Tokens emitidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokens' }
 *       401: { description: Credenciales inválidas, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       429: { description: Demasiados intentos }
 */
authRouter.post('/login', authLimiter, authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Genera un nuevo access token a partir de un refresh token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Nuevo access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *       401: { description: Refresh token inválido o expirado }
 */
authRouter.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoca el refresh token (server-side)
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: OK }
 */
authRouter.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Devuelve el usuario actual y sus roles
 *     responses:
 *       200:
 *         description: Usuario + roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/AuthUser' }
 *                 roles: { type: array, items: { type: string } }
 *       401: { description: No autenticado }
 */
authRouter.get('/me', authMiddleware, authController.getMe);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia el flujo de reset de contraseña (envía email si el usuario existe)
 *     security: []
 *     description: Siempre devuelve éxito para no revelar si el email está registrado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Se envió email si el usuario existe }
 */
authRouter.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
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
        getLogger({ component: 'auth', op: 'password-reset-email' }).error(
          { err, email: cleanEmail },
          'Failed to send reset email',
        );
      }
    }

    res.json({ success: true, message: 'Si el email existe, recibirás instrucciones' });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Cambia la contraseña usando el token enviado por email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 4 }
 *     responses:
 *       200: { description: Contraseña actualizada }
 *       400: { description: Token inválido o expirado }
 */
authRouter.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new BadRequestError('Token y contraseña son requeridos');
    }
    if (password.length < 12) {
      throw new BadRequestError('La contraseña debe tener al menos 12 caracteres');
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestError('Token inválido o expirado');
    }

    // Update password
    const passwordHash = await hashPassword(password);
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
    if (!password || password.length < 12) {
      throw new BadRequestError('La contraseña debe tener al menos 12 caracteres');
    }

    const passwordHash = await hashPassword(password);
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
