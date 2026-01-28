// ============================================
// Type Definitions
// ============================================

import { Request } from 'express';

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export type AppRole = 'admin' | 'instructor' | 'learner';
export type LTIRole = 'instructor' | 'learner' | 'admin' | 'content_developer';

// ============================================
// Scenario Types
// ============================================

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  objection: string;
  clientPersona: string;
  firstMessage?: string;
  voiceType: 'male' | 'female';
  difficulty: 'easy' | 'medium' | 'hard';
  scriptContent?: Record<string, unknown>;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

// ============================================
// Practice Session Types
// ============================================

export interface PracticeSession {
  id: string;
  userId: string;
  scenarioId?: string;
  durationSeconds: number;
  score?: number;
  passed: boolean;
  rating?: number;
  aiFeedback?: string;
  createdAt: Date;
}

export interface SessionEvaluation {
  score: number;
  passed: boolean;
  feedback: string;
  breakdown?: {
    apertura?: number;
    escucha_activa?: number;
    manejo_objeciones?: number;
    propuesta_valor?: number;
    cierre?: number;
  };
}

export interface CreateSessionInput {
  scenarioId?: string;
  durationSeconds?: number;
  score?: number;
  passed?: boolean;
  rating?: number;
  aiFeedback?: string;
}

export interface UpdateSessionInput {
  durationSeconds?: number;
  score?: number;
  passed?: boolean;
  rating?: number;
  aiFeedback?: string;
}

// ============================================
// Progress Types
// ============================================

export interface UserProgress {
  id: string;
  userId: string;
  scenarioId: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  bestScore?: number;
  attempts: number;
  firstCompletedAt?: Date;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  totalSessions: number;
  totalTime: number;
  avgScore: number;
  completedScenarios: number;
  practiceDays: number;
}

// ============================================
// LTI Types
// ============================================

export interface LTIPlatform {
  id: string;
  name: string;
  issuerUrl: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  deploymentId: string;
  isActive: boolean;
}

export interface LTISession {
  id: string;
  userId: string;
  platformId: string;
  ltiUserId: string;
  ltiEmail?: string;
  ltiName?: string;
  contextId?: string;
  contextTitle?: string;
  resourceLinkId?: string;
  roles: LTIRole[];
  lastLaunchAt: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
