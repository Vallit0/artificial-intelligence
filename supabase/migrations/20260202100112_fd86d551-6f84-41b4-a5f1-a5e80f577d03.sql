-- Create table for admin emails (allowed admins)
CREATE TABLE public.admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can check if their email is in the admin list
CREATE POLICY "Users can check their own admin status"
  ON public.admin_emails
  FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Create table for student final grades (for certificates)
CREATE TABLE public.student_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  graded_by uuid NOT NULL,
  final_grade numeric(4,2) NOT NULL CHECK (final_grade >= 0 AND final_grade <= 100),
  notes text,
  certificate_generated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_emails
    WHERE email = (auth.jwt() ->> 'email')
  )
$$;

-- Admins can view all grades
CREATE POLICY "Admins can view all grades"
  ON public.student_grades
  FOR SELECT
  USING (public.is_admin());

-- Admins can insert grades
CREATE POLICY "Admins can insert grades"
  ON public.student_grades
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update grades
CREATE POLICY "Admins can update grades"
  ON public.student_grades
  FOR UPDATE
  USING (public.is_admin());

-- Users can view their own grade
CREATE POLICY "Users can view own grade"
  ON public.student_grades
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_student_grades_updated_at
  BEFORE UPDATE ON public.student_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a profiles table to store user names for certificates
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles (needed for admin panel)
CREATE POLICY "Authenticated can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();