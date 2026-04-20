// ============================================
// Admin Routes
// ============================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { handleError } from '../utils/errors.js';
import * as adminService from '../services/admin.service.js';
import * as agentConfigService from '../services/agentConfig.service.js';
import * as prospectingScenariosService from '../services/prospectingScenarios.service.js';
import * as sessionsService from '../services/sessions.service.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as abTestingController from '../controllers/abTesting.controller.js';
import * as aiAccessService from '../services/aiAccess.service.js';
import prisma from '../db/index.js';

export const adminRouter = Router();

// All admin routes require authentication + admin role
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin'));

// ============================================
// GET /api/admin/students
// ============================================
adminRouter.get('/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const students = await adminService.getAllStudents();
    res.json(students);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/users - Create single user
// ============================================
adminRouter.post('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createUser(req.body);
    res.status(201).json({ success: true, user: result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/users/bulk - Bulk create users
// ============================================
adminRouter.post('/users/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.bulkCreateUsers(req.body.users);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// DELETE /api/admin/users/:id
// ============================================
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.deleteUser(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/admin/users/:id/password
// ============================================
adminRouter.patch('/users/:id/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.updateUserPassword(req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/admin/users/:id/name
// ============================================
adminRouter.patch('/users/:id/name', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName } = req.body;
    const result = await adminService.updateUserName(req.params.id, firstName, lastName);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// PATCH /api/admin/users/:id/examen-final
// ============================================
adminRouter.patch('/users/:id/examen-final', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body;
    const result = await adminService.toggleExamenFinal(req.params.id, !!enabled);
    res.json({ success: true, ...result });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// POST /api/admin/grades - Upsert grade
// ============================================
adminRouter.post('/grades', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, finalGrade, notes } = req.body;
    const grade = await adminService.upsertGrade(userId, req.user!.id, finalGrade, notes);
    res.json({ success: true, grade });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Agent Config CRUD
// ============================================
adminRouter.get('/agent-configs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await agentConfigService.getAll();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.put('/agent-configs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { secretName, agentId, label } = req.body;
    const config = await agentConfigService.upsert(secretName, agentId, label);
    res.json({ success: true, config });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.delete('/agent-configs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await agentConfigService.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// Prospecting Scenarios: Prompts + Visibility
// ============================================
adminRouter.get('/prospecting-scenarios', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prospectingScenariosService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.put('/prospecting-scenarios', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { secretName, label, systemPrompt, firstMessage, isActiveGlobal } = req.body;
    if (!secretName) {
      res.status(400).json({ error: 'secretName required' });
      return;
    }
    const config = await prospectingScenariosService.upsertConfig(secretName, {
      label,
      systemPrompt,
      firstMessage,
      isActiveGlobal,
    });
    res.json({ success: true, config });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.get('/user-scenario-access/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const access = await prospectingScenariosService.getUserAccess(req.params.userId);
    res.json(access);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.put('/user-scenario-access/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body as { entries: Array<{ secretName: string; enabled: boolean }> };
    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'entries array required' });
      return;
    }
    await prospectingScenariosService.bulkSetUserAccess(req.params.userId, entries);
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// AI Access Kill-Switch (global)
// ============================================
adminRouter.get('/ai-access', (_req: AuthRequest, res: Response) => {
  res.json(aiAccessService.getLockStatus());
});

adminRouter.put('/ai-access', (req: AuthRequest, res: Response) => {
  const { locked, reason } = req.body as { locked?: boolean; reason?: string };
  aiAccessService.setAiLocked(!!locked, reason ?? null);
  res.json({ success: true, ...aiAccessService.getLockStatus() });
});

// ============================================
// Admin Analytics
// ============================================
adminRouter.get('/analytics', analyticsController.getAdminAnalytics);

// ============================================
// A/B Testing Experiments
// ============================================
adminRouter.get('/experiments', abTestingController.list);
adminRouter.post('/experiments', abTestingController.create);
adminRouter.get('/experiments/:id', abTestingController.getById);
adminRouter.put('/experiments/:id', abTestingController.update);
adminRouter.delete('/experiments/:id', abTestingController.remove);
adminRouter.get('/experiments/:id/results', abTestingController.getResults);

// ============================================
// Admin Session Transcript (view any student's session)
// ============================================
adminRouter.get('/sessions/:id/transcript', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await sessionsService.getTranscriptAdmin(req.params.id);
    res.json(data);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

// ============================================
// LTI Platform CRUD
// ============================================
adminRouter.get('/lti-platforms', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platforms = await prisma.ltiPlatform.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(platforms);
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.post('/lti-platforms', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId } = req.body;
    const platform = await prisma.ltiPlatform.create({
      data: { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId },
    });
    res.status(201).json({ success: true, platform });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.put('/lti-platforms/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId, isActive } = req.body;
    const platform = await prisma.ltiPlatform.update({
      where: { id: req.params.id },
      data: { name, issuerUrl, clientId, authEndpoint, tokenEndpoint, jwksUrl, deploymentId, isActive },
    });
    res.json({ success: true, platform });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

adminRouter.delete('/lti-platforms/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.ltiPlatform.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const appError = handleError(error);
    res.status(appError.statusCode).json({ error: appError.message });
  }
});
