-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('admin', 'instructor', 'learner', 'coach');

-- CreateEnum
CREATE TYPE "LtiRole" AS ENUM ('instructor', 'learner', 'admin', 'content_developer');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('debilidad', 'fortaleza', 'expresion', 'comportamiento', 'progreso');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "PricingService" AS ENUM ('elevenlabs', 'openai', 'infra');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('per_minute', 'per_token_input', 'per_token_output', 'monthly');

-- CreateEnum
CREATE TYPE "CitaTipo" AS ENUM ('presencial', 'virtual', 'telefonica');

-- CreateEnum
CREATE TYPE "CitaPrioridad" AS ENUM ('alta', 'media', 'baja');

-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "phone_number" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "examen_final_enabled" BOOLEAN NOT NULL DEFAULT false,
    "level2_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "sede_id" TEXT,
    "coach_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "can_create_coaches" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_prompts" BOOLEAN NOT NULL DEFAULT false,
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer_url" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "auth_endpoint" TEXT NOT NULL,
    "token_endpoint" TEXT NOT NULL,
    "jwks_url" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "lti_user_id" TEXT NOT NULL,
    "lti_email" TEXT,
    "lti_name" TEXT,
    "context_id" TEXT,
    "context_title" TEXT,
    "resource_link_id" TEXT,
    "roles" "LtiRole"[] DEFAULT ARRAY[]::"LtiRole"[],
    "ags_lineitem_url" TEXT,
    "ags_lineitems_url" TEXT,
    "ags_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nrps_memberships_url" TEXT,
    "last_launch_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_keys" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "public_key_pem" TEXT NOT NULL,
    "private_key_enc" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "tool_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_course_syncs" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "context_id" TEXT NOT NULL,
    "context_title" TEXT,
    "memberships_url" TEXT NOT NULL,
    "lineitem_url" TEXT,
    "default_sede_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_course_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_pending_matches" (
    "id" TEXT NOT NULL,
    "course_sync_id" TEXT NOT NULL,
    "lti_user_id" TEXT NOT NULL,
    "lti_email" TEXT,
    "lti_name" TEXT,
    "candidate_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_user_id" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_pending_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_launch_states" (
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lti_launch_states_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "lti_deep_linking_states" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "return_url" TEXT NOT NULL,
    "data" TEXT,
    "lti_user_id" TEXT NOT NULL,
    "context_id" TEXT,
    "context_title" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_deep_linking_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objection" TEXT NOT NULL,
    "client_persona" TEXT NOT NULL,
    "first_message" TEXT,
    "voice_type" TEXT NOT NULL DEFAULT 'female',
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "script_content" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario_id" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "ai_feedback" TEXT,
    "transcript" JSONB,
    "ab_variant_id" TEXT,
    "connect_ms" INTEGER,
    "ttfa_samples_ms" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_breakdowns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "apertura" INTEGER NOT NULL DEFAULT 0,
    "escucha_activa" INTEGER NOT NULL DEFAULT 0,
    "manejo_objeciones" INTEGER NOT NULL DEFAULT 0,
    "propuesta_valor" INTEGER NOT NULL DEFAULT 0,
    "cierre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scenario_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "is_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "best_score" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "first_completed_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_scenario_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_grades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "graded_by" TEXT,
    "final_grade" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "certificate_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT,
    "summary" TEXT NOT NULL,
    "score" INTEGER,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "recommendation" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" TEXT NOT NULL,
    "director" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,
    "asesor_name" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "tipo" "CitaTipo" NOT NULL DEFAULT 'presencial',
    "prioridad" "CitaPrioridad" NOT NULL DEFAULT 'media',
    "link_sala" TEXT,
    "notas" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "secret_name" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_scenario_configs" (
    "id" TEXT NOT NULL,
    "secret_name" TEXT NOT NULL,
    "label" TEXT,
    "system_prompt" TEXT,
    "first_message" TEXT,
    "is_active_global" BOOLEAN NOT NULL DEFAULT true,
    "builder_params" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecting_scenario_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scenario_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_scenario_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agent_secret_name" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_variants" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_prompt" TEXT,
    "first_message" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ab_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_assignments" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rates" (
    "id" TEXT NOT NULL,
    "service" "PricingService" NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "unit_price_usd" DECIMAL(12,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sedes_slug_key" ON "sedes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sedes_name_key" ON "sedes"("name");

-- CreateIndex
CREATE INDEX "sedes_is_active_idx" ON "sedes"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_sede_id_idx" ON "users"("sede_id");

-- CreateIndex
CREATE INDEX "users_coach_id_idx" ON "users"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_permissions_user_id_key" ON "coach_permissions"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "lti_platforms_issuer_url_key" ON "lti_platforms"("issuer_url");

-- CreateIndex
CREATE INDEX "lti_platforms_issuer_url_idx" ON "lti_platforms"("issuer_url");

-- CreateIndex
CREATE INDEX "lti_sessions_user_id_idx" ON "lti_sessions"("user_id");

-- CreateIndex
CREATE INDEX "lti_sessions_platform_id_lti_user_id_idx" ON "lti_sessions"("platform_id", "lti_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lti_sessions_platform_id_lti_user_id_key" ON "lti_sessions"("platform_id", "lti_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_keys_kid_key" ON "tool_keys"("kid");

-- CreateIndex
CREATE INDEX "tool_keys_is_active_idx" ON "tool_keys"("is_active");

-- CreateIndex
CREATE INDEX "lti_course_syncs_is_active_idx" ON "lti_course_syncs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "lti_course_syncs_platform_id_context_id_key" ON "lti_course_syncs"("platform_id", "context_id");

-- CreateIndex
CREATE INDEX "lti_pending_matches_resolved_at_idx" ON "lti_pending_matches"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "lti_pending_matches_course_sync_id_lti_user_id_key" ON "lti_pending_matches"("course_sync_id", "lti_user_id");

-- CreateIndex
CREATE INDEX "lti_launch_states_expires_at_idx" ON "lti_launch_states"("expires_at");

-- CreateIndex
CREATE INDEX "lti_deep_linking_states_expires_at_idx" ON "lti_deep_linking_states"("expires_at");

-- CreateIndex
CREATE INDEX "scenarios_is_active_display_order_idx" ON "scenarios"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "practice_sessions_user_id_created_at_idx" ON "practice_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "practice_sessions_scenario_id_idx" ON "practice_sessions"("scenario_id");

-- CreateIndex
CREATE INDEX "practice_sessions_ab_variant_id_idx" ON "practice_sessions"("ab_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_breakdowns_session_id_key" ON "evaluation_breakdowns"("session_id");

-- CreateIndex
CREATE INDEX "user_scenario_progress_user_id_idx" ON "user_scenario_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scenario_progress_user_id_scenario_id_key" ON "user_scenario_progress"("user_id", "scenario_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_grades_user_id_key" ON "student_grades"("user_id");

-- CreateIndex
CREATE INDEX "advisor_memories_user_id_importance_idx" ON "advisor_memories"("user_id", "importance" DESC);

-- CreateIndex
CREATE INDEX "advisor_memories_user_id_category_idx" ON "advisor_memories"("user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "session_summaries_session_id_key" ON "session_summaries"("session_id");

-- CreateIndex
CREATE INDEX "session_summaries_user_id_created_at_idx" ON "session_summaries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "citas_asesor_id_idx" ON "citas"("asesor_id");

-- CreateIndex
CREATE INDEX "citas_director_idx" ON "citas"("director");

-- CreateIndex
CREATE INDEX "citas_fecha_idx" ON "citas"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_secret_name_key" ON "agent_configs"("secret_name");

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_scenario_configs_secret_name_key" ON "prospecting_scenario_configs"("secret_name");

-- CreateIndex
CREATE INDEX "user_scenario_access_user_id_idx" ON "user_scenario_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scenario_access_user_id_secret_name_key" ON "user_scenario_access"("user_id", "secret_name");

-- CreateIndex
CREATE INDEX "ab_experiments_status_idx" ON "ab_experiments"("status");

-- CreateIndex
CREATE INDEX "ab_variants_experiment_id_idx" ON "ab_variants"("experiment_id");

-- CreateIndex
CREATE INDEX "ab_assignments_user_id_idx" ON "ab_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ab_assignments_experiment_id_user_id_key" ON "ab_assignments"("experiment_id", "user_id");

-- CreateIndex
CREATE INDEX "pricing_rates_service_unit_is_active_idx" ON "pricing_rates"("service", "unit", "is_active");

-- CreateIndex
CREATE INDEX "pricing_rates_effective_from_idx" ON "pricing_rates"("effective_from");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_permissions" ADD CONSTRAINT "coach_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_sessions" ADD CONSTRAINT "lti_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_sessions" ADD CONSTRAINT "lti_sessions_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "lti_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_course_syncs" ADD CONSTRAINT "lti_course_syncs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "lti_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_course_syncs" ADD CONSTRAINT "lti_course_syncs_default_sede_id_fkey" FOREIGN KEY ("default_sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_pending_matches" ADD CONSTRAINT "lti_pending_matches_course_sync_id_fkey" FOREIGN KEY ("course_sync_id") REFERENCES "lti_course_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_deep_linking_states" ADD CONSTRAINT "lti_deep_linking_states_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "lti_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_breakdowns" ADD CONSTRAINT "evaluation_breakdowns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scenario_progress" ADD CONSTRAINT "user_scenario_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scenario_progress" ADD CONSTRAINT "user_scenario_progress_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_memories" ADD CONSTRAINT "advisor_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_variants" ADD CONSTRAINT "ab_variants_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "ab_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_assignments" ADD CONSTRAINT "ab_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "ab_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_assignments" ADD CONSTRAINT "ab_assignments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ab_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

