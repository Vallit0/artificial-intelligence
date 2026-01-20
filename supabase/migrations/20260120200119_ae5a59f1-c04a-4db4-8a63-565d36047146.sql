-- Create function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create enum for LTI roles
CREATE TYPE public.lti_role AS ENUM ('instructor', 'learner', 'admin', 'content_developer');

-- Create table for LTI platforms (Moodle instances)
CREATE TABLE public.lti_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    issuer_url TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    auth_endpoint TEXT NOT NULL,
    token_endpoint TEXT NOT NULL,
    jwks_url TEXT NOT NULL,
    deployment_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for LTI sessions (links Moodle users to Supabase users)
CREATE TABLE public.lti_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform_id UUID REFERENCES public.lti_platforms(id) ON DELETE CASCADE NOT NULL,
    lti_user_id TEXT NOT NULL,
    lti_email TEXT,
    lti_name TEXT,
    context_id TEXT,
    context_title TEXT,
    resource_link_id TEXT,
    roles lti_role[] DEFAULT '{}',
    last_launch_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_lti_sessions_user_id ON public.lti_sessions(user_id);
CREATE INDEX idx_lti_sessions_lti_user_id ON public.lti_sessions(lti_user_id);
CREATE UNIQUE INDEX idx_lti_sessions_platform_user ON public.lti_sessions(platform_id, lti_user_id);

-- Enable RLS
ALTER TABLE public.lti_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lti_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for lti_platforms (read-only for authenticated users)
CREATE POLICY "Authenticated users can view active platforms"
ON public.lti_platforms
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS policies for lti_sessions (users can only see their own sessions)
CREATE POLICY "Users can view their own LTI sessions"
ON public.lti_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create updated_at trigger for lti_platforms
CREATE TRIGGER update_lti_platforms_updated_at
BEFORE UPDATE ON public.lti_platforms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();