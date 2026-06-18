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
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Permisos granulares para usuarios con rol `coach`. Vienen de la tabla
// coach_permissions. Si el user no tiene rol coach o no hay fila, estos
// flags se consideran `false`.
export interface CoachPermissionFlags {
  canCreateCoaches: boolean;
  canEditPrompts: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  examenFinalEnabled?: boolean;
  level2Unlocked?: boolean;
  courseCompleted?: boolean;
  tutorialCompleted?: boolean;
  // sedeId puede ser null durante la ventana del backfill (usuarios viejos
  // que aún no fueron asignados). Cualquier endpoint sede-scoped debe
  // rechazar requests con sedeId null vía `requireSede(req)`.
  sedeId: string | null;
  // Roles efectivos resueltos en el middleware de auth, para que los
  // controllers no tengan que volver a consultar `user_roles`.
  roles: AppRole[];
  // Sólo presente si el user tiene rol coach. Cualquier check de permiso
  // debe usar `coachPermissions?.canX ?? false`.
  coachPermissions?: CoachPermissionFlags;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export type AppRole = 'admin' | 'instructor' | 'learner' | 'coach';

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

export interface EvaluationBreakdown {
  apertura: number;
  escuchaActiva: number;
  manejoObjeciones: number;
  propuestaValor: number;
  cierre: number;
}

export interface TranscriptMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
}

export interface PracticeSession {
  id: string;
  userId: string;
  scenarioId?: string;
  durationSeconds: number;
  score?: number;
  passed: boolean;
  rating?: number;
  aiFeedback?: string;
  transcript?: TranscriptMessage[];
  abVariantId?: string;
  examType?: ExamType;
  practiceMode?: PracticeMode;
  breakdown?: EvaluationBreakdown;
  createdAt: Date;
}

// Marca qué examen produjo la sesión. null/undefined = práctica normal.
// 'prospeccion' = Examen Final del módulo de Prospección (Nivel 1);
// 'objeciones' = Examen Final del módulo de Manejo de Objeciones (Nivel 2).
export type ExamType = 'prospeccion' | 'objeciones';

// Modo de práctica con el que corrió una sesión (se fija al crearla). Permite
// desglosar el tiempo de práctica por modo en analítica:
// 'cliente'             = Role-Play Cliente (Nivel 1);
// 'cliente_prospeccion' = Prospección, sub-modo de Role-Play Cliente;
// 'asesor'              = Role-Play Asesor;
// 'objeciones'          = Role-Play Objeciones (Nivel 2);
// 'coach'               = sesión con el Coach.
// Los exámenes finales se siguen distinguiendo con ExamType, no acá.
export type PracticeMode =
  | 'cliente'
  | 'cliente_prospeccion'
  | 'asesor'
  | 'objeciones'
  | 'coach';

// 'real' = LLM produced a valid evaluation
// 'too_short' = transcript below MIN_TURNS_FOR_REAL_EVAL — score is 0
// 'fallback_practice' = LLM unreachable on a practice session — neutral 50
// 'fallback_exam' = LLM unreachable on the final exam — score forced to 0
export type EvaluationStatus = 'real' | 'too_short' | 'fallback_practice' | 'fallback_exam';

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
  evaluationStatus?: EvaluationStatus;
}

// score, passed and aiFeedback are intentionally excluded from these inputs.
// Those fields are write-only by the server-side evaluation flow
// (sessions.service.saveEvaluation) so a client cannot self-assign a passing
// grade via PATCH /api/sessions/:id or POST /api/sessions.
export interface CreateSessionInput {
  scenarioId?: string | null;
  durationSeconds?: number;
  rating?: number | null;
  abVariantId?: string | null;
  examType?: ExamType | null;
  practiceMode?: PracticeMode | null;
}

export interface UpdateSessionInput {
  durationSeconds?: number;
  rating?: number | null;
  connectMs?: number | null;
  ttfaSamplesMs?: number[];
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
// Advisor Memory Types
// ============================================

export type MemoryCategory = 'debilidad' | 'fortaleza' | 'expresion' | 'comportamiento' | 'progreso';

export interface AdvisorMemory {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveMemoryInput {
  user_id: string;
  content: string;
  category: MemoryCategory;
  importance?: number;
}

export interface RetrieveMemoryInput {
  user_id: string;
  category?: MemoryCategory;
  limit?: number;
}

export interface SessionSummaryData {
  id: string;
  userId: string;
  sessionId: string;
  scenarioId?: string;
  summary: string;
  score?: number;
  strengths: string[];
  weaknesses: string[];
  recommendation?: string;
  durationSeconds: number;
  createdAt: Date;
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

// ============================================
// A/B Testing Types
// ============================================

export type ExperimentStatus = 'draft' | 'active' | 'completed';

export interface AbExperiment {
  id: string;
  name: string;
  description?: string;
  agentSecretName: string;
  status: ExperimentStatus;
  variants?: AbVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AbVariant {
  id: string;
  experimentId: string;
  name: string;
  systemPrompt?: string;
  firstMessage?: string;
  weight: number;
}

export interface AbAssignment {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
}

export interface AbVariantResults {
  variantId: string;
  variantName: string;
  sessionCount: number;
  avgScore: number | null;
  avgDuration: number | null;
  passRate: number;
  breakdownAvg: {
    apertura: number | null;
    escuchaActiva: number | null;
    manejoObjeciones: number | null;
    propuestaValor: number | null;
    cierre: number | null;
  };
}
