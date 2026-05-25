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
/**
 * @openapi
 * /api/citas:
 *   get:
 *     tags: [Citas]
 *     summary: Lista citas agendadas dentro de un rango de fechas
 *     description: >-
 *       Devuelve las citas cuya fecha cae en el rango [start, end].
 *       El resultado es sede-aware: un caller con scope de sede sólo ve las
 *       citas de asesores de su sede; un admin global ve todas las sedes.
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema: { type: string, format: date-time }
 *         description: Fecha/hora inicial del rango (ISO).
 *       - in: query
 *         name: end
 *         required: true
 *         schema: { type: string, format: date-time }
 *         description: Fecha/hora final del rango (ISO).
 *       - in: query
 *         name: director
 *         required: false
 *         schema: { type: string }
 *         description: Filtra por nombre exacto de director.
 *       - in: query
 *         name: prioridad
 *         required: false
 *         schema: { type: string, enum: [alta, media, baja] }
 *         description: Filtra por prioridad.
 *     responses:
 *       200:
 *         description: Citas ordenadas por fecha y hora de inicio (cada una incluye asesor y creator)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   director: { type: string }
 *                   asesorId: { type: string, format: uuid }
 *                   asesorName: { type: string }
 *                   cliente: { type: string }
 *                   municipio: { type: string }
 *                   ciudad: { type: string }
 *                   zona: { type: string }
 *                   fecha: { type: string, format: date-time }
 *                   horaInicio: { type: string, example: "08:00" }
 *                   tipo: { type: string, enum: [presencial, virtual, telefonica] }
 *                   prioridad: { type: string, enum: [alta, media, baja] }
 *                   linkSala: { type: string, nullable: true }
 *                   notas: { type: string, nullable: true }
 *                   createdBy: { type: string, format: uuid }
 *                   createdAt: { type: string, format: date-time }
 *                   updatedAt: { type: string, format: date-time }
 *                   asesor:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       email: { type: string, format: email }
 *                       firstName: { type: string }
 *                       lastName: { type: string }
 *                   creator:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       email: { type: string, format: email }
 *                       firstName: { type: string }
 *                       lastName: { type: string }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
/**
 * @openapi
 * /api/citas/directors:
 *   get:
 *     tags: [Citas]
 *     summary: Lista los directores distintos presentes en las citas
 *     description: >-
 *       Devuelve los nombres de director únicos, ordenados alfabéticamente.
 *       Sede-aware: un caller con scope de sede sólo ve directores de citas de
 *       asesores de su sede.
 *     responses:
 *       200:
 *         description: Nombres de director distintos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: string }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
/**
 * @openapi
 * /api/citas/users:
 *   get:
 *     tags: [Citas]
 *     summary: Lista usuarios candidatos a asesor (para el selector de asignación)
 *     description: >-
 *       Devuelve usuarios para el picker de asesor, ordenados por nombre.
 *       Sede-aware: un caller con scope de sede sólo ve usuarios de su sede.
 *     responses:
 *       200:
 *         description: Usuarios disponibles como asesor
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   email: { type: string, format: email }
 *                   firstName: { type: string }
 *                   lastName: { type: string }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
/**
 * @openapi
 * /api/citas:
 *   post:
 *     tags: [Citas]
 *     summary: Crea una cita
 *     description: >-
 *       Crea una cita asignada a un asesor. El asesor debe pertenecer a la sede
 *       del caller (salvo admin global). El campo createdBy se toma del usuario
 *       autenticado, no del body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [director, asesorId, cliente, fecha, horaInicio]
 *             properties:
 *               director: { type: string }
 *               asesorId: { type: string, format: uuid }
 *               asesorName: { type: string }
 *               cliente: { type: string }
 *               municipio: { type: string }
 *               ciudad: { type: string }
 *               zona: { type: string }
 *               fecha: { type: string, format: date-time, description: "Fecha ISO de la cita" }
 *               horaInicio: { type: string, example: "08:00" }
 *               tipo: { type: string, enum: [presencial, virtual, telefonica], default: presencial }
 *               prioridad: { type: string, enum: [alta, media, baja], default: media }
 *               linkSala: { type: string }
 *               notas: { type: string }
 *     responses:
 *       201:
 *         description: Cita creada (incluye asesor y creator)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 director: { type: string }
 *                 asesorId: { type: string, format: uuid }
 *                 asesorName: { type: string }
 *                 cliente: { type: string }
 *                 municipio: { type: string }
 *                 ciudad: { type: string }
 *                 zona: { type: string }
 *                 fecha: { type: string, format: date-time }
 *                 horaInicio: { type: string, example: "08:00" }
 *                 tipo: { type: string, enum: [presencial, virtual, telefonica] }
 *                 prioridad: { type: string, enum: [alta, media, baja] }
 *                 linkSala: { type: string, nullable: true }
 *                 notas: { type: string, nullable: true }
 *                 createdBy: { type: string, format: uuid }
 *                 createdAt: { type: string, format: date-time }
 *                 updatedAt: { type: string, format: date-time }
 *                 asesor:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                 creator:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *       400: { description: Faltan campos requeridos o el asesor no existe, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: El asesor pertenece a otra sede, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
/**
 * @openapi
 * /api/citas/{id}:
 *   patch:
 *     tags: [Citas]
 *     summary: Actualiza parcialmente una cita
 *     description: >-
 *       Actualiza los campos enviados de una cita existente. Sede-aware: un
 *       caller con scope de sede sólo puede modificar citas de su sede (de lo
 *       contrario devuelve 404 para no filtrar existencia). Si se reasigna el
 *       asesor, el nuevo asesor también debe ser de la misma sede.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID de la cita.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Todos los campos son opcionales (subconjunto del body de creación).
 *             properties:
 *               director: { type: string }
 *               asesorId: { type: string, format: uuid }
 *               asesorName: { type: string }
 *               cliente: { type: string }
 *               municipio: { type: string }
 *               ciudad: { type: string }
 *               zona: { type: string }
 *               fecha: { type: string, format: date-time }
 *               horaInicio: { type: string, example: "08:00" }
 *               tipo: { type: string, enum: [presencial, virtual, telefonica] }
 *               prioridad: { type: string, enum: [alta, media, baja] }
 *               linkSala: { type: string }
 *               notas: { type: string }
 *     responses:
 *       200:
 *         description: Cita actualizada (incluye asesor y creator)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 director: { type: string }
 *                 asesorId: { type: string, format: uuid }
 *                 asesorName: { type: string }
 *                 cliente: { type: string }
 *                 municipio: { type: string }
 *                 ciudad: { type: string }
 *                 zona: { type: string }
 *                 fecha: { type: string, format: date-time }
 *                 horaInicio: { type: string, example: "08:00" }
 *                 tipo: { type: string, enum: [presencial, virtual, telefonica] }
 *                 prioridad: { type: string, enum: [alta, media, baja] }
 *                 linkSala: { type: string, nullable: true }
 *                 notas: { type: string, nullable: true }
 *                 createdBy: { type: string, format: uuid }
 *                 createdAt: { type: string, format: date-time }
 *                 updatedAt: { type: string, format: date-time }
 *                 asesor:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                 creator:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *       400: { description: El nuevo asesor no existe, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: El nuevo asesor pertenece a otra sede, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Cita no encontrada (o fuera del scope de sede del caller), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
/**
 * @openapi
 * /api/citas/{id}:
 *   delete:
 *     tags: [Citas]
 *     summary: Elimina una cita
 *     description: >-
 *       Sólo admin global o coach con acceso a la sede de la cita. La validación
 *       de sede ocurre en el service para coaches; el admin global atraviesa
 *       todas las sedes. Si la cita está fuera del scope del coach devuelve 404.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID de la cita.
 *     responses:
 *       200:
 *         description: Cita eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: El caller no tiene rol admin ni coach, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Cita no encontrada (o fuera del scope de sede del caller), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
citasRouter.delete('/:id', requireRole('admin', 'coach'), async (req: AuthRequest, res: Response) => {
  try {
    await citasService.deleteCita(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
