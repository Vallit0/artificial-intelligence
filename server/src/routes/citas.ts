// ============================================
// Citas (Appointments) Routes
// ============================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';
import * as citasService from '../services/citas.service.js';

export const citasRouter = Router();

// All citas routes require authentication
citasRouter.use(authMiddleware);

// ============================================
// GET /api/citas - Get citas by date range
// ============================================
citasRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { start, end, director, prioridad } = req.query;
    const citas = await citasService.getCitasByRange(
      start as string,
      end as string,
      req.user!,
      {
        director: director as string | undefined,
        prioridad: prioridad as any,
      }
    );
    res.json(citas);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// GET /api/citas/directors - List distinct directors
// ============================================
citasRouter.get('/directors', async (req: AuthRequest, res: Response) => {
  try {
    const directors = await citasService.getDirectors(req.user!);
    res.json(directors);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// GET /api/citas/users - List users for asesor picker
// ============================================
citasRouter.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await citasService.getUsers(req.user!);
    res.json(users);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/citas - Create cita
// ============================================
citasRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const cita = await citasService.createCita(req.body, req.user!.id, req.user!);
    res.status(201).json(cita);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/citas/:id - Update cita
// ============================================
citasRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cita = await citasService.updateCita(req.params.id, req.body, req.user!);
    res.json(cita);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// DELETE /api/citas/:id - Delete cita (admin only)
// ============================================
// Delete: admin global o coach con acceso a la sede de la cita. La validación
// de sede ocurre en el service para coaches, y admin global atraviesa.
citasRouter.delete('/:id', requireRole('admin', 'coach'), async (req: AuthRequest, res: Response) => {
  try {
    await citasService.deleteCita(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
