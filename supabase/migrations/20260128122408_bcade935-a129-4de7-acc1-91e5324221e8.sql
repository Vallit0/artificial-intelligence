-- Add score and completion fields to practice_sessions
ALTER TABLE public.practice_sessions 
ADD COLUMN IF NOT EXISTS score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS passed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_feedback text DEFAULT NULL;

-- Create a table to track user progress on scenarios (unlocked status)
CREATE TABLE IF NOT EXISTS public.user_scenario_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  best_score INTEGER DEFAULT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, scenario_id)
);

-- Enable RLS on user_scenario_progress
ALTER TABLE public.user_scenario_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_scenario_progress
CREATE POLICY "Users can view their own progress"
ON public.user_scenario_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
ON public.user_scenario_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
ON public.user_scenario_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_scenario_progress_updated_at
BEFORE UPDATE ON public.user_scenario_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add display_order to scenarios for proper ordering
ALTER TABLE public.scenarios
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;