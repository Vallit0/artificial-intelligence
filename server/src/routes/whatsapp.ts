// ============================================
// WhatsApp Routes
// ============================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { handleError, BadRequestError } from '../utils/errors.js';
import * as whapiService from '../services/whapi.service.js';
import prisma from '../db/index.js';

export const whatsappRouter = Router();

// ============================================
// POST /api/whatsapp/send-text (Admin only)
// Send a test/manual WhatsApp message
// ============================================
whatsappRouter.post('/send-text', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      throw new BadRequestError('Se requiere phone y message');
    }

    const result = await whapiService.sendText({ to: phone, body: message });
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/whatsapp/send-to-user (Admin only)
// Send a WhatsApp message to a registered user by userId
// ============================================
whatsappRouter.post('/send-to-user', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      throw new BadRequestError('Se requiere userId y message');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true, fullName: true },
    });

    if (!user?.phoneNumber) {
      throw new BadRequestError('El usuario no tiene número de WhatsApp registrado');
    }

    const result = await whapiService.sendText({ to: user.phoneNumber, body: message });
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/whatsapp/agent-send
// Called by ElevenLabs Server Tool during conversation
// No auth middleware - ElevenLabs calls this directly
// ============================================
whatsappRouter.post('/agent-send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phone_number, message, document_url, document_name } = req.body;

    if (!phone_number) {
      return res.json({ success: false, error: 'No se proporcionó número de teléfono' });
    }

    // If there's a document to send
    if (document_url) {
      await whapiService.sendDocument({
        to: phone_number,
        mediaUrl: document_url,
        filename: document_name || 'documento.pdf',
        caption: message || 'Aquí tienes el documento solicitado.',
      });
      return res.json({
        success: true,
        message: `Documento "${document_name || 'documento.pdf'}" enviado por WhatsApp al ${phone_number}`,
      });
    }

    // Text-only message
    if (!message) {
      return res.json({ success: false, error: 'No se proporcionó mensaje ni documento' });
    }

    await whapiService.sendText({ to: phone_number, body: message });
    res.json({
      success: true,
      message: `Mensaje enviado por WhatsApp al ${phone_number}`,
    });
  } catch (error) {
    // Return graceful error so the agent can inform the user
    console.error('WhatsApp agent-send error:', error);
    res.json({
      success: false,
      error: 'No se pudo enviar el mensaje por WhatsApp. Por favor intenta más tarde.',
    });
  }
});

// ============================================
// GET /api/whatsapp/status
// Check if WHAPI is configured
// ============================================
whatsappRouter.get('/status', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  res.json({ configured: whapiService.isConfigured() });
});
