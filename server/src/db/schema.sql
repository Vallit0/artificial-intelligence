-- ============================================
-- Schema for Señoriales Monolithic Server
-- PostgreSQL compatible (Huawei Cloud RDS)
-- ============================================

-- User roles enum
CREATE TYPE app_role AS ENUM ('admin', 'instructor', 'learner');
CREATE TYPE lti_role AS ENUM ('instructor', 'learner', 'admin', 'content_developer');

-- ============================================
-- Users table (replaces Supabase auth.users)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- NULL for LTI/SSO users
  full_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- User roles table
-- ============================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ============================================
-- Refresh tokens for JWT auth
-- ============================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- LTI Platforms (Moodle, etc.)
-- ============================================
CREATE TABLE lti_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  issuer_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  auth_endpoint TEXT NOT NULL,
  token_endpoint TEXT NOT NULL,
  jwks_url TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lti_platforms_issuer ON lti_platforms(issuer_url);

-- ============================================
-- LTI Sessions (links LTI users to local users)
-- ============================================
CREATE TABLE lti_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE CASCADE NOT NULL,
  lti_user_id TEXT NOT NULL,
  lti_email TEXT,
  lti_name TEXT,
  context_id TEXT,
  context_title TEXT,
  resource_link_id TEXT,
  roles lti_role[] DEFAULT '{}',
  last_launch_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform_id, lti_user_id)
);

CREATE INDEX idx_lti_sessions_user_id ON lti_sessions(user_id);
CREATE INDEX idx_lti_sessions_platform_user ON lti_sessions(platform_id, lti_user_id);

-- ============================================
-- Scenarios (sales practice scenarios)
-- ============================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  objection TEXT NOT NULL,
  client_persona TEXT NOT NULL,
  first_message TEXT,
  voice_type TEXT DEFAULT 'female',
  difficulty TEXT DEFAULT 'medium',
  script_content JSONB,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scenarios_active ON scenarios(is_active, display_order);

-- ============================================
-- Practice Sessions
-- ============================================
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  duration_seconds INTEGER DEFAULT 0,
  score INTEGER,
  passed BOOLEAN DEFAULT false,
  rating INTEGER,
  ai_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_practice_sessions_user ON practice_sessions(user_id, created_at DESC);
CREATE INDEX idx_practice_sessions_scenario ON practice_sessions(scenario_id);

-- ============================================
-- User Scenario Progress
-- ============================================
CREATE TABLE user_scenario_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
  is_unlocked BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  best_score INTEGER,
  attempts INTEGER DEFAULT 0,
  first_completed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, scenario_id)
);

CREATE INDEX idx_user_progress_user ON user_scenario_progress(user_id);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lti_platforms_updated_at
  BEFORE UPDATE ON lti_platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_scenario_progress_updated_at
  BEFORE UPDATE ON user_scenario_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
